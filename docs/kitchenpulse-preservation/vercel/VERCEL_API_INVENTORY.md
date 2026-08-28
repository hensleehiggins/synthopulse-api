# Vercel API Inventory

## Scope and reading rules

Inventory basis: tracked `api/` source at commit `c9486bb`. In Vercel file routing, each handler below maps to the shown `/api/...` path. `OPTIONS` is omitted where it is only CORS preflight. All route responses are JSON unless the source performs a redirect. No caller UI source is in this repository, so Softr/mobile callers remain unverified. Environment-variable names are in `ENVIRONMENT_MANIFEST.md`; values are not preserved.

`Source-auth` below means a route checks a secret/header or uses Clerk/operator context in source. It does **not** prove the deployed route is safely protected. `No shared-auth helper` means no `_auth.js` enforcement was found, not that the route is intentionally public.

## Shared server-side helper

| File | Role | Dependencies and effects |
| --- | --- | --- |
| `api/_auth.js` | Not an intended public handler; shared Clerk/operator authorization library | Verifies Clerk bearer tokens, fetches Clerk user email when needed, finds/backfills Airtable `Operator Users`, and returns restaurant/role/access context. It can update `Auth Provider User ID` and last-login data. |

## API handlers

| Route and source | Methods | Purpose / request and response shape | Auth evidence | Data/services and side effects | Criticality |
| --- | --- | --- | --- | --- | --- |
| `/api/app-usage-events` — `app-usage-events.js` | POST | Accepts usage event JSON; returns event result JSON | Authorization header handling | Airtable usage/operator tables; writes telemetry | Unknown |
| `/api/approve-event`, `/api/promote-event`, `/api/deny-event` — respective files | POST | Event decision action JSON; returns event/action JSON | No shared-auth helper | Reads/writes Event Intake Queue and/or External Factors | Production-critical if active Softr event workflow uses it |
| `/api/ask-ai`, `/api/ask-synthopulse` | GET, POST | Health/metadata or prompt JSON; returns AI answer/context JSON | Header handling in source | Airtable context plus OpenAI; no Airtable mutation apparent in route response path | Optional/unknown |
| `/api/auth`, `/api/auth-check` | GET; GET/POST | Tripleseat auth status/redirect or auth verification JSON | `auth-check` has header handling; `auth` redirects | Tripleseat OAuth configuration | Production-critical for Tripleseat connection |
| `/api/billing-command-center` | GET, POST | Reads billing view; creates/updates profile/invoice action JSON | `x-billing-secret`/authorization source handling | Airtable Restaurants, Billing Profiles, Billing Invoices; writes billing mirrors. Stripe is identified as system of record | Production-critical if billing console active |
| `/api/cost-source-items` | GET | Query/filters return cost-source and movement JSON | Header handling | Airtable Cost Source Items and Cost Movement; read-only | Operational |
| `/api/create-local-event`, `/api/update-event` | GET, POST | Read configuration/record then create or update event JSON | `update-event` header handling; create has no shared helper | Airtable Event Intake Queue/External Factors; writes events | Production-critical if local-event workflow active |
| `/api/env-check` | Source-defined handler | Returns redacted presence/status diagnostics | No shared-auth helper found | Reads environment presence only; sensitive diagnostic route | Unknown—must be access-reviewed |
| `/api/events-timeline`, `/api/home-alert` | GET | Upcoming-event / home-alert query JSON | home-alert header handling; timeline no shared helper | Airtable External Factors and related signals; read-only | Operational |
| `/api/google-business-events-sync` | GET, POST | Fetch/sync Google event data; JSON result | `GOOGLE_BUSINESS_SYNC_SECRET` bearer check | Google Business Profile + Airtable Event Intake Queue; writes on sync path | Production-critical if enabled |
| `/api/latest-brief` | GET | Returns latest Forecasts & Insights/brief JSON | Header handling | Airtable Forecasts & Insights; read-only | Production-critical known deployed route |
| `/api/operator-account`, `/api/operator-invite` | GET/POST; POST | List/create operator or invitation action JSON | Secret/header handling; Clerk admin API | Airtable Operator Users and Clerk invitations; writes identities/access metadata | Production-critical |
| `/api/order-intelligence` | GET | Query returns ordering intelligence JSON | Header handling | Airtable Par Levels, receipt lines, trends, stock/count/cost data; read-only | Operational |
| `/api/order-item-suggestions` | GET | Query/limit returns matching ordering items JSON | Header handling | Airtable Cost Source Items and Par Levels; read-only | Operational |
| `/api/order-rule-setup` | GET, POST, PATCH, DELETE | Lists or mutates par/order rule JSON | Header handling | Airtable Par Levels; creates/updates/deletes rules | Production-critical if ordering setup active |
| `/api/pre-shift-huddle` | GET, POST | Returns/generates huddle JSON from request/context | Header handling | Airtable plus OpenAI; likely read/generation path | Optional/operational |
| `/api/receipt-intake`, `/api/receipt-mobile-submit` | GET, POST | Receipt metadata or multipart/mobile upload; returns staging/parse status JSON | Header handling | Vercel Blob, Airtable Vendor Receipts, OpenAI; writes blobs and records | Production-critical if receipt workflow active |
| `/api/receipt-parse` | GET, POST | Gets or parses a receipt; returns parse/review JSON | Header handling | Airtable Vendor Receipts/Vendor Receipt Lines plus OpenAI; writes parsed results | Production-critical if receipt workflow active |
| `/api/receipt-lines`, `/api/receipt-review`, `/api/receipt-cost-proposals` | GET, POST/PATCH/DELETE as implemented | Listing/review/proposal action JSON | Header handling | Airtable receipt-line, proposal, cost, inventory, ingredient tables; writes review/proposal decisions | Operational |
| `/api/refresh-movement-costs`, `/api/refresh-weekly-item-trends` | GET, POST | Refresh action with optional restaurant/query and optional admin secret; returns refresh summary JSON | `ADMIN_REFRESH_SECRET` when set; no Clerk helper | Airtable Menu Items, movement, costs, runs, Daily Sales, Weekly Item Trends; bulk writes/upserts/deactivations | Production-critical background candidate |
| `/api/shift-watch`, `/api/staffing-board`, `/api/staff-reliability-signals` | GET | Staffing watch/board/signals query JSON | shift-watch header handling; others no shared helper | Airtable staffing/signal records; read-only | Operational |
| `/api/stock-count-submit` | GET, POST | Session lookup or submitted count JSON | Calls shared operator authorization | Vercel Blob + Airtable Stock Count Sessions/Lines; writes sessions/lines | Production-critical if stock count active |
| `/api/stock-count-review` | GET, POST | Review queue or review decision JSON | Header handling | Airtable Stock Count Lines; writes review state | Operational |
| `/api/tripleseat/auth`, `/api/tripleseat-auth-start`, `/api/tripleseat/callback` | GET | Begins/continues OAuth redirect/callback; JSON or redirect | OAuth state/configuration | Tripleseat OAuth and Airtable Integration Accounts; writes token/account metadata | Production-critical for integration restore |
| `/api/tripleseat-board`, `/api/tripleseat-leads-board` | GET (leads source also has action branch) | Returns normalized event/lead board JSON | Board no shared helper; leads header handling | Tripleseat/Airtable-backed views | Operational |
| `/api/tripleseat-events-probe`, `-leads-probe`, `-locations-test`, `-oauth-probe`, `-probe` | GET/POST as implemented | Connection/debug probe JSON | Provider authorization/header handling | Calls Tripleseat endpoints; diagnostic, no primary write intent apparent | Optional/unknown |
| `/api/tripleseat-sync`, `/api/tripleseat-sync-events` | GET, POST | Sync/dry-run/action parameters; returns sync summary JSON | Provider/header handling | Tripleseat plus Airtable Integration Accounts/Event Intake Queue/External Factors; `sync-events` writes only with `write=1` | Production-critical background candidate |
| `/api/tripleseat-webhook` | GET, POST | Health response or Tripleseat webhook payload; returns receipt/action JSON | Reads signature headers; webhook-secret configuration exists | Airtable Event Intake Queue; creates/updates events | Production-critical inbound integration |

## Configuration and callers

- No tracked `vercel.json`, `.vercel/project.json`, cron configuration, workflow, or UI caller source exists. Deployment/project settings, functions settings, aliases/domains, and scheduled invocations must be captured from Vercel manually.
- Identifiable source-side URLs reference `project-1csz2.vercel.app` in operator invite, huddle, shift-watch, and Tripleseat OAuth probe code. No Softr page/block caller maps are in Git.
- External hosts found in source: `api.airtable.com`, `api.clerk.com`, `api.openai.com`, Tripleseat hosts, `mybusiness.googleapis.com`, `oauth2.googleapis.com`, Vercel Blob package use, and SynthoPulse portal domains.
