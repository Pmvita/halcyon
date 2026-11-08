import { HalcyonError } from "./errors";

export type Lot = {
  id: string;
  symbol: string;
  accountId: string;
  qty: number;
  costPerUnit: number;
  openedAt: string;
};

export type LotMethod = "fifo" | "lifo" | "specific";

export function allocateLots(
  lots: Lot[],
  qty: number,
  method: LotMethod,
  specificIds: string[] = [],
): { allocations: { lot: Lot; qty: number }[]; basis: number } {
  if (qty <= 0) throw new HalcyonError("qty", "Quantity must be greater than zero.");
  let ordered: Lot[];
  if (method === "specific") {
    ordered = specificIds.map((id) => {
      const lot = lots.find((item) => item.id === id);
      if (!lot) throw new HalcyonError("lots", "One of the selected lots is no longer open.");
      return lot;
    });
  } else if (method === "lifo") {
    ordered = [...lots].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  } else {
    ordered = [...lots].sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  }
  const allocations: { lot: Lot; qty: number }[] = [];
  let left = qty;
  for (const lot of ordered) {
    if (left <= 1e-9) break;
    const take = Math.min(lot.qty, left);
    if (take > 0) {
      allocations.push({ lot, qty: take });
      left -= take;
    }
  }
  if (left > 1e-6) throw new HalcyonError("lots", "Not enough quantity in the selected lots.");
  const basis = allocations.reduce((sum, item) => sum + item.qty * item.lot.costPerUnit, 0);
  return { allocations, basis };
}

export function applySplit(lots: Lot[], symbol: string, numerator: number, denominator: number): Lot[] {
  if (numerator <= 0 || denominator <= 0) throw new HalcyonError("split", "A split needs a positive ratio.");
  return lots.map((lot) =>
    lot.symbol !== symbol
      ? lot
      : {
          ...lot,
          qty: (lot.qty * numerator) / denominator,
          costPerUnit: (lot.costPerUnit * denominator) / numerator,
        },
  );
}

export function renameSymbol(lots: Lot[], from: string, to: string): Lot[] {
  return lots.map((lot) => (lot.symbol === from ? { ...lot, symbol: to } : lot));
}
