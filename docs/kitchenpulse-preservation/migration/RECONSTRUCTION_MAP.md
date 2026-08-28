# Reconstruction Map

This is documentation only. It does not implement a replacement UI.

| Current surface (source evidence) | Vercel API surface | Airtable sources | Eventual Vercel/React reconstruction unit | Status |
| --- | --- | --- | --- | --- |
| Softr dashboard / latest brief | `latest-brief`, `home-alert`, `shift-watch` | Forecasts & Insights; External Factors; staffing data | Authenticated dashboard route with read-model cards | Softr page/block mapping still manual |
| Softr events/local demand | `events-timeline`, `create-local-event`, `update-event`, approve/promote/deny routes | Event Intake Queue; External Factors | Event timeline, review queue, event editor/action controls | API/data mapping source-backed; Softr actions unknown |
| Softr ordering | `order-intelligence`, `order-item-suggestions`, `order-rule-setup` | Par Levels; cost/receipt/trend/count tables | Ordering board, suggestions search, par-rule editor | Source-backed |
| Softr receipts/cost review | Receipt intake/mobile/parse/lines/review/proposal routes | Vendor Receipts/Lines; proposals; inventory/cost tables | Upload, parse status, line review, proposal workflow | Source-backed; visual UX/actions manual |
| Softr staffing | `staffing-board`, `staff-reliability-signals`, `shift-watch` | Staffing and reliability records | Staffing board and watch view | Source-backed; exact pages unknown |
| Softr intelligence/AI | `ask-ai`, `ask-synthopulse`, `pre-shift-huddle` | Brief/movement/event/sales/menu/cost context | Prompt/huddle UI with explicit error/loading states | Source-backed; prompt UI/manual bindings unknown |
| Operator/admin access | `_auth`, `auth-check`, `operator-account`, `operator-invite` | Operator Users; Restaurants | Clerk-protected settings/admin route | Provider configuration/manual permissions still needed |
| Tripleseat pages/actions | Board, lead, OAuth, sync, webhook handlers | Integration Accounts; Event Intake Queue; External Factors | Integration settings, event/lead board, sync controls | Source-backed; OAuth/provider setup/manual pages needed |
| Billing command center | `billing-command-center` | Restaurants; Billing Profiles; Billing Invoices | Admin billing read/action interface; Stripe deep links | Source-backed; Stripe/provider state needed |

## Deterministic migration prerequisites

Before replacement UI work, attach each Softr page/block to one table row above, document its filters/sorts/visibility/Call API mapping, export full Vibe generated code, and capture app-level theme/auth/groups/custom code. Preserve API contracts as they are observed; do not infer them from a page label.
