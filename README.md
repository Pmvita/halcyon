# Halcyon

One desk for cash, markets, and crypto. Halcyon is a simulated private client. Balances, cards, transfers, and trades settle on an internal double-entry ledger. Quotes that can be fetched from public sources are real, and every quote shows its source, age, and status.

Halcyon holds no customer funds. It does not route live orders. No FDIC or SIPC protection applies, because nothing is deposited.

## Run the web desk

```bash
cd halcyon
cp .env.example .env
pnpm install
pnpm dev
```

Open http://localhost:3000. Postgres is embedded (PGlite) when `DATABASE_URL` is empty, so you do not need Docker. Leave every key blank. The desk still opens, with a shipped equity snapshot and public no-key endpoints for crypto, FX, yields, and explorers when they answer.

Optional Docker Postgres and Redis are in `docker-compose.yml`. Set `DATABASE_URL` and `REDIS_URL` only if you want them. The in-memory cache implements the same budget interface.

## Sign in

| Person | Email | Password |
| --- | --- | --- |
| Maya Chen | maya@halcyon.demo | meridian-desk |
| Andre Walsh | andre@halcyon.demo | meridian-desk |
| Elena Marlowe | elena@halcyon.demo | meridian-desk |
| Admin | admin@halcyon.demo | meridian-desk |

Do not reuse `meridian-desk` anywhere else. It exists only so a reviewer can enter the demo.

## Ten-minute review

1. Sign in as Maya. Read the banner: simulated balances, real market data.
2. On Banking, send a bill payment and open its pending state.
3. Open AAPL. Place a market buy of 100 shares. The displayed depth fills 40 and cancels the rest. The tape is labeled Session replay on a weekend.
4. Open the AAPL options payoff. The chain is a model and stays Delayed.
5. Open Bonds and read the Treasury ladder. Prices are marked as a model, not a dealer quote.
6. On Crypto, read a public BTC address such as the genesis address. Do not enter a seed phrase. The screen says watch-only.
7. Toggle dark or high contrast from Profile → Settings.
8. Download a specimen statement.
9. Read the fee schedule and the terms.
10. Reset Andre from Profile. Maya’s ledger stays.

## Mobile

```bash
pnpm dev:mobile
```

Set `EXPO_PUBLIC_API_URL` to the machine running the web API. Android emulator often uses `http://10.0.2.2:3000`. The Expo app shares types, tokens, and formatters with the web desk. A Maestro smoke file is at `apps/mobile/.maestro/smoke.yaml`.

## Tests

```bash
pnpm test
```

Domain tests cover transfer, insufficient funds, reversal, dividend, partial fill, cancel, crypto fees, option expiry, split, and a burst of 100 quote loads that stops at the configured upstream cap. The server test signs in as Maya, moves cash, and partial-fills AAPL.

## What is simulated

The journal is append-only. Mistakes are reversed, not edited. Idempotency keys collapse retries. US equities use 9:30–16:00 America/New_York. Outside that window, weekend clock mode replays a small synthetic path around the shipped close and says so. Crypto is 24/7. Slippage, spreads, and fees are described on the fee schedule and in Help.

Market data is fetched on the server. If a provider budget is spent, the last cached or shipped value is shown with the reason.
