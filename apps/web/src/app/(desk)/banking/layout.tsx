import Link from "next/link";

const LINKS = [
  ["/banking", "Accounts"],
  ["/banking/move", "Move"],
  ["/banking/cards", "Cards"],
  ["/banking/activity", "Activity"],
  ["/banking/goals", "Goals"],
  ["/banking/loans", "Loans"],
  ["/banking/cds", "CDs"],
  ["/banking/deposit", "Deposit"],
  ["/banking/statements", "Documents"],
  ["/banking/disputes", "Disputes"],
  ["/banking/alerts", "Alerts"],
  ["/banking/household", "Household"],
] as const;

export default function BankingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="banking-desk">
      <nav className="bank-nav" aria-label="Banking">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </nav>
      <p className="demo-chip" role="note">DEMO · No customer funds · No real ACH, wires, or cards</p>
      {children}
    </div>
  );
}
