import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney, formatPct } from "@halcyon/domain";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Plan",
  description: "Budgets, goals, and the marked book for the Halcyon demo household.",
};

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await (await halcyon()).plan(user.id);
  return (
    <>
      <p className="kicker">Plan</p>
      <h1 className="serif" style={{ fontSize: 56 }}>The book</h1>
      <p className="lede">{plan.note} Fund goals and envelopes from <Link href="/banking/goals">Banking → Goals</Link>.</p>
      <section className="figures">
        <article><span>Market</span><strong className="num">{formatMoney(Math.round(plan.market * 100))}</strong></article>
        <article><span>Cost</span><strong className="num">{formatMoney(Math.round(plan.cost * 100))}</strong></article>
        <article><span>Simple return</span><strong className="num">{formatPct(plan.simpleReturn)}</strong></article>
      </section>
      <h2 className="serif">Budgets</h2>
      {plan.budgets.map((budget) => {
        const spent = plan.spend.find((item) => item.category === String(budget.category))?.amountMinor ?? 0;
        return <div className="row" key={String(budget.id)}><span>{String(budget.category)}</span><span className="num">{formatMoney(spent)} of {formatMoney(Number(budget.limit_minor))}</span></div>;
      })}
      <h2 className="serif">Goals</h2>
      {plan.goals.map((goal) => (
        <div className="row" key={String(goal.id)}><span>{String(goal.name)}</span><span className="num">{formatMoney(Number(goal.saved_minor))} / {formatMoney(Number(goal.target_minor))}</span></div>
      ))}
    </>
  );
}
