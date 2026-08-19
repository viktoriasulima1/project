# Pilot Environment Matrix

| Variable | Local | E2E | Pilot | Secret | Browser | Required pilot |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | local DB | overridden E2E DB | isolated pilot DB | Yes | No | Yes |
| `PILOT_DATABASE_URL` | absent | absent | isolated pilot DB | Yes | No | Yes for migration |
| `NEXT_PUBLIC_APP_URL` | optional localhost | optional | stable HTTPS origin | No | Yes | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_` | test | `pk_live_` | No | Yes | Yes |
| `CLERK_SECRET_KEY` | `sk_test_` | test | `sk_live_` | Yes | No | Yes |
| `NEXT_PUBLIC_BUILD_VERSION` | optional | optional | immutable release ID | No | Yes | Yes |
| `E2E_RUN` / `E2E_MOCK_*` | false | true where needed | prohibited | No | No | Must be absent |
| `ALLOW_DEV_FARM_FALLBACK` | optional dev | absent | prohibited | No | No | Must be absent |
| `PILOT_MIGRATION_CONFIRM` | absent | absent | one-shot `true` | No | No | Migration only |

Future production is a separate environment and must not automatically inherit pilot users, database, domain or secrets.
