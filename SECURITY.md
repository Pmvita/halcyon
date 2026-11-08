# Security

Halcyon is a demonstration. It protects the demo user’s simulated privacy and the server’s API keys. It does not secure real money, because it holds none.

## Threat model

- Demo passwords are hashed with Argon2id. The seed password is shown on the sign-in screen and must not be reused anywhere.
- Web sessions are random tokens stored only as SHA-256 hashes. The cookie is httpOnly and SameSite=Lax. It is marked Secure in production.
- State-changing requests must come from the same host and send `X-Halcyon-Request: 1`.
- Provider keys, if you add them, belong in server environment variables. The browser bundle does not receive them. The data-health page shows budgets and errors, not secrets.
- Memos and payee names are escaped by React and stripped of markup characters before they are stored. The app does not inject user memos as HTML.
- There are no third-party analytics scripts. The optional product counter stays in the browser and is off unless you build that toggle on.
- Simulated KYC files, if captured, stay in the local data directory and are part of the persona you can reset.
- Watch-only crypto reads a public explorer for a validated address. The server does not accept a seed phrase, a private key, or an arbitrary URL to proxy.
- Optional Alpaca paper keys, if present, can mirror a stock order to Alpaca’s paper venue. If they are absent, the UI does not mention Alpaca.

## Out of scope

Halcyon does not talk to ACH, card networks, brokerage routing, or mainnet custody. A determined person with access to the demo database can edit simulated balances. That is not a financial loss, because the balances are not money.

Reset a persona from Profile, or delete the `.data` directory, to wipe this install.
