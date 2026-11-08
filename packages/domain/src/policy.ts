import { FEE } from "./fees";
import { formatMoney } from "./format";

export function reviewSend(input: { amountMinor: number; sentTodayMinor: number }): { stepUp: boolean; hold: boolean; reason?: string } {
  if (input.sentTodayMinor + input.amountMinor > FEE.dailySendMinor) {
    return {
      stepUp: true,
      hold: true,
      reason: `Held. The demo daily send limit is ${formatMoney(FEE.dailySendMinor)}, and this payment would pass it. Nothing was sent.`,
    };
  }
  if (input.amountMinor >= FEE.stepUpMinor) {
    return { stepUp: true, hold: false, reason: "This amount needs a step-up confirmation." };
  }
  return { stepUp: false, hold: false };
}
