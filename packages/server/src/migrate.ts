export const migrateSql = `
CREATE TABLE IF NOT EXISTS households (
  id text PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  persona text NOT NULL,
  household_id text,
  handle text,
  theme text NOT NULL DEFAULT 'system',
  density text NOT NULL DEFAULT 'comfortable',
  display_currency text NOT NULL DEFAULT 'USD',
  intro_seen boolean NOT NULL DEFAULT false,
  terms_version text,
  terms_accepted_at timestamptz,
  kyc_status text NOT NULL DEFAULT 'unverified',
  replay_enabled boolean NOT NULL DEFAULT true,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  household_id text,
  visibility text NOT NULL,
  kind text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  currency text NOT NULL,
  apy_bps integer,
  apr_bps integer,
  credit_limit_minor integer,
  maturity_date text,
  overdraft_enabled boolean NOT NULL DEFAULT false,
  overdraft_link_id text,
  status text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS journal_entries (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  idempotency_key text UNIQUE,
  kind text NOT NULL,
  memo text NOT NULL,
  actor_id text,
  reverses_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS journal_lines (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES journal_entries(id),
  account_id text NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_lines_account ON journal_lines(account_id);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  device text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  actor_id text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  actor_id text NOT NULL,
  from_account_id text,
  to_account_id text,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  memo text,
  idempotency_key text UNIQUE,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  fee_minor integer NOT NULL DEFAULT 0,
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS payees (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  name text NOT NULL,
  nickname text,
  handle text,
  category text,
  last_paid_minor integer,
  average_minor integer
);
CREATE TABLE IF NOT EXISTS holds (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  merchant text,
  city text,
  category text,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  owner_id text NOT NULL,
  last4 text NOT NULL,
  status text NOT NULL,
  frozen boolean NOT NULL DEFAULT false,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  account_id text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  order_type text NOT NULL,
  qty double precision NOT NULL,
  filled_qty double precision NOT NULL,
  limit_price double precision,
  stop_price double precision,
  tif text NOT NULL,
  status text NOT NULL,
  asset_class text NOT NULL,
  avg_price double precision,
  reject_reason text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS executions (
  id text PRIMARY KEY,
  order_id text NOT NULL,
  qty double precision NOT NULL,
  price double precision NOT NULL,
  liquidity text NOT NULL,
  fee double precision NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS lots (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  symbol text NOT NULL,
  qty double precision NOT NULL,
  cost_per_unit double precision NOT NULL,
  opened_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS inbox (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS disputes (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  account_id text,
  status text NOT NULL,
  reason text NOT NULL,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS beneficiaries (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  account_id text NOT NULL,
  name text NOT NULL,
  relation text NOT NULL,
  share_pct integer NOT NULL
);
CREATE TABLE IF NOT EXISTS budgets (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  category text NOT NULL,
  limit_minor integer NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  target_minor integer NOT NULL,
  saved_minor integer NOT NULL
);
CREATE TABLE IF NOT EXISTS watches (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  chain text NOT NULL,
  address text NOT NULL,
  label text NOT NULL
);
CREATE TABLE IF NOT EXISTS earns (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  symbol text NOT NULL,
  qty double precision NOT NULL,
  rate double precision NOT NULL,
  status text NOT NULL,
  unbond_at timestamptz
);
CREATE TABLE IF NOT EXISTS perps (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  qty double precision NOT NULL,
  entry double precision NOT NULL,
  leverage double precision NOT NULL,
  margin_minor integer NOT NULL,
  status text NOT NULL,
  liq double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  symbol text NOT NULL,
  kind text NOT NULL,
  threshold double precision NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS watch_items (
  user_id text NOT NULL,
  symbol text NOT NULL,
  PRIMARY KEY (user_id, symbol)
);
CREATE TABLE IF NOT EXISTS option_papers (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  underlying text NOT NULL,
  contract_type text NOT NULL,
  strike double precision NOT NULL,
  expiry text NOT NULL,
  premium double precision NOT NULL,
  contracts double precision NOT NULL,
  iv double precision NOT NULL,
  status text NOT NULL
);
CREATE TABLE IF NOT EXISTS stepups (
  user_id text PRIMARY KEY,
  until timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS document_downloads (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  kind text NOT NULL,
  label text NOT NULL,
  format text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS banking_alerts (
  user_id text PRIMARY KEY,
  low_balance boolean NOT NULL DEFAULT true,
  large_pay boolean NOT NULL DEFAULT true,
  card_spend boolean NOT NULL DEFAULT true,
  low_balance_minor integer NOT NULL DEFAULT 50000
);
CREATE TABLE IF NOT EXISTS recurring_transfers (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  from_account_id text NOT NULL,
  to_account_id text,
  payee_id text,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  kind text NOT NULL,
  memo text,
  cadence text NOT NULL,
  next_run timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS check_deposits (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  account_id text NOT NULL,
  amount_minor integer NOT NULL,
  filename text NOT NULL,
  status text NOT NULL,
  available_at timestamptz,
  created_at timestamptz NOT NULL
);
`;
