import { Money } from "@/components/money";

export default function SandboxPage() {
  return (
    <>
      <p className="kicker">UI inventory</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Sandbox</h1>
      <p>Buttons, a ticket summary, and both themes. Switch theme from Profile → Settings. High contrast is a separate theme, not a filter.</p>
      <div className="sandbox-split">
        <div data-theme="light" style={{ background: "#f4f0e6", color: "#1c1914" }}>
          <p className="kicker">Light</p>
          <button className="btn-solid" type="button">Solid</button>
          <button className="btn-line" type="button">Line</button>
          <p><Money minor={124018} /> · <Money minor={-4200} signed /></p>
        </div>
        <div data-theme="dark" style={{ background: "#0c1014", color: "#f3efe6" }}>
          <p className="kicker">Dark</p>
          <button className="btn-solid" type="button">Solid</button>
          <button className="btn-line" type="button">Line</button>
          <p><Money minor={124018} /> · <Money minor={-4200} signed /></p>
        </div>
      </div>
    </>
  );
}
