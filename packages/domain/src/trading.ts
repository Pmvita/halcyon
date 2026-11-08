import { HalcyonError } from "./errors";
import { type AssetClass, slippageBps, tradeFee } from "./fees";
import { formatMoney } from "./format";

export type Side = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit" | "trailing_stop" | "moc" | "loc";
export type TimeInForce = "day" | "gtc" | "ioc" | "fok";
export type OrderStatus = "open" | "partial" | "filled" | "cancelled" | "rejected";

export type WorkingOrder = {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  trailBps?: number;
  trailAnchor?: number;
  tif: TimeInForce;
  status: OrderStatus;
  assetClass: AssetClass;
  rejectReason?: string;
};

export type Fill = {
  orderId: string;
  qty: number;
  price: number;
  liquidity: "maker" | "taker";
  fee: number;
  at: string;
};

export type QuoteBook = { bid: number; ask: number; last: number };

export function synthesizeBook(last: number, spreadBps: number): QuoteBook {
  const half = (last * spreadBps) / 10_000 / 2;
  return { bid: last - half, ask: last + half, last };
}

export function takerPrice(side: Side, book: QuoteBook, qty: number): number {
  const touch = side === "buy" ? book.ask : book.bid;
  const slip = slippageBps(Math.abs(qty * touch)) / 10_000;
  return side === "buy" ? touch * (1 + slip) : touch * (1 - slip);
}

export function assertBuyingPower(neededMinor: number, powerMinor: number): void {
  if (powerMinor + 0.5 < neededMinor) {
    throw new HalcyonError(
      "buying_power",
      `Insufficient buying power. This order needs about ${formatMoney(neededMinor)} and settled buying power is ${formatMoney(powerMinor)}. Unsettled sale proceeds stay unavailable under the demo good-faith rule.`,
    );
  }
}

function reject(order: WorkingOrder, reason: string): { order: WorkingOrder; fills: Fill[] } {
  return { order: { ...order, status: "rejected", rejectReason: reason }, fills: [] };
}

export function validateOrder(order: WorkingOrder, book: QuoteBook, sessionTradable: boolean, expired = false): string | null {
  if (expired) return "This option is expired, so the order was not accepted.";
  if (!(order.qty > order.filledQty)) return "Nothing remains to trade on this order.";
  if (!sessionTradable && (order.assetClass === "equity" || order.assetClass === "etf" || order.assetClass === "option")) {
    return "The cash session is closed. Turn session replay on to trade the last tape.";
  }
  if ((order.type === "limit" || order.type === "loc" || order.type === "stop_limit") && !(order.limitPrice && order.limitPrice > 0)) {
    return "Enter a limit price.";
  }
  if ((order.type === "stop" || order.type === "stop_limit") && !(order.stopPrice && order.stopPrice > 0)) {
    return "Enter a stop price.";
  }
  if (order.type === "stop_limit" && order.limitPrice && order.stopPrice) {
    const through = order.side === "buy" ? order.limitPrice < order.stopPrice : order.limitPrice > order.stopPrice;
    if (through) return "Limit is through the stop, so this stop-limit cannot be booked.";
  }
  if (order.type === "trailing_stop" && !(order.trailBps && order.trailBps > 0)) return "Enter a trail distance.";
  if (book.ask <= 0 || book.bid <= 0) return "No eligible price is available, so the ticket did not send the order.";
  return null;
}

export function matchOnce(input: {
  order: WorkingOrder;
  book: QuoteBook;
  displayedQty: number;
  sessionTradable: boolean;
  now: string;
  atClose?: boolean;
  expired?: boolean;
}): { order: WorkingOrder; fills: Fill[] } {
  const reason = validateOrder(input.order, input.book, input.sessionTradable, input.expired);
  if (reason) return reject(input.order, reason);
  let order = { ...input.order };
  if (order.type === "trailing_stop") {
    const anchor = order.trailAnchor ?? input.book.last;
    const nextAnchor = order.side === "sell" ? Math.max(anchor, input.book.last) : Math.min(anchor, input.book.last);
    order = { ...order, trailAnchor: nextAnchor };
    const trail = (order.trailBps ?? 0) / 10_000;
    const trigger = order.side === "sell" ? nextAnchor * (1 - trail) : nextAnchor * (1 + trail);
    const armed = order.side === "sell" ? input.book.last <= trigger : input.book.last >= trigger;
    if (!armed || nextAnchor === input.book.last) return { order, fills: [] };
    order = { ...order, type: "market" };
  }
  if (order.type === "stop" || order.type === "stop_limit") {
    const armed = order.side === "buy" ? input.book.last >= (order.stopPrice ?? Infinity) : input.book.last <= (order.stopPrice ?? 0);
    if (!armed) return { order, fills: [] };
    if (order.type === "stop") order = { ...order, type: "market" };
    else order = { ...order, type: "limit" };
  }
  if ((order.type === "moc" || order.type === "loc") && !input.atClose) return { order, fills: [] };

  const remaining = order.qty - order.filledQty;
  const marketable = isMarketable(order, input.book);
  if (!marketable) return { order, fills: [] };
  if (input.displayedQty <= 0) {
    return reject(order, "The displayed book is empty, so nothing filled.");
  }
  let take = Math.min(remaining, input.displayedQty);
  if (order.tif === "fok" && take + 1e-9 < remaining) {
    return reject(order, "Fill-or-kill could not take the full quantity in the displayed size.");
  }
  const raw = order.type === "market" || order.type === "moc" ? takerPrice(order.side, input.book, take) : limitFillPrice(order, input.book, take);
  const price = order.side === "buy" && order.limitPrice ? Math.min(raw, order.limitPrice) : order.side === "sell" && order.limitPrice ? Math.max(raw, order.limitPrice) : raw;
  const liquidity = order.type === "limit" || order.type === "loc" ? "maker" : "taker";
  const fee = tradeFee(order.assetClass, order.type === "market" ? "taker" : liquidity, take, price);
  const fill: Fill = { orderId: order.id, qty: take, price, liquidity: order.type === "market" || order.type === "moc" ? "taker" : "maker", fee, at: input.now };
  const filledQty = order.filledQty + take;
  const done = filledQty >= order.qty - 1e-9;
  let status: OrderStatus = done ? "filled" : "partial";
  if (!done && (order.type === "market" || order.type === "moc" || order.tif === "ioc")) status = "cancelled";
  return { order: { ...order, filledQty, status }, fills: [fill] };
}

function isMarketable(order: WorkingOrder, book: QuoteBook): boolean {
  if (order.type === "market" || order.type === "moc") return true;
  if (order.type === "limit" || order.type === "loc") {
    if (!order.limitPrice) return false;
    return order.side === "buy" ? book.ask <= order.limitPrice : book.bid >= order.limitPrice;
  }
  return false;
}

function limitFillPrice(order: WorkingOrder, book: QuoteBook, qty: number): number {
  const touch = order.side === "buy" ? book.ask : book.bid;
  const slipped = takerPrice(order.side, book, qty);
  if (order.side === "buy") return Math.min(order.limitPrice ?? slipped, Math.max(touch, Math.min(slipped, order.limitPrice ?? slipped)));
  return Math.max(order.limitPrice ?? slipped, Math.min(touch, Math.max(slipped, order.limitPrice ?? slipped)));
}

export function cancelOrder(order: WorkingOrder): WorkingOrder {
  if (order.status === "filled" || order.status === "cancelled" || order.status === "rejected") {
    throw new HalcyonError("state", `This order is already ${order.status} and cannot be cancelled.`);
  }
  return { ...order, status: "cancelled" };
}

export function estimateFill(order: Pick<WorkingOrder, "side" | "type" | "qty" | "limitPrice" | "assetClass">, book: QuoteBook): {
  price: number;
  notional: number;
  fee: number;
  slippage: number;
  spread: number;
  marketable: boolean;
} {
  const draft: WorkingOrder = {
    id: "est",
    symbol: "",
    tif: "day",
    status: "open",
    filledQty: 0,
    ...order,
  };
  const marketable = isMarketable(draft.type === "stop" || draft.type === "stop_limit" || draft.type === "trailing_stop" ? { ...draft, type: "market" } : draft, book) || draft.type === "market";
  const price = draft.type === "limit" || draft.type === "loc" ? draft.limitPrice ?? book.ask : takerPrice(draft.side, book, draft.qty);
  const touch = draft.side === "buy" ? book.ask : book.bid;
  const notional = price * draft.qty;
  const liquidity = draft.type === "limit" ? "maker" : "taker";
  return {
    price,
    notional,
    fee: tradeFee(draft.assetClass, liquidity, draft.qty, price),
    slippage: Math.abs(price - touch) * draft.qty,
    spread: Math.abs(book.ask - book.bid),
    marketable,
  };
}
