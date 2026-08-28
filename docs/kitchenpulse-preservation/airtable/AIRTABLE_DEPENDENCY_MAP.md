# Airtable Dependency Map

## Durable identifiers

| Base / table | Source evidence |
| --- | --- |
| Base `appD303evZM2SlvMR` | Hard-coded fallback in `billing-command-center.js`, `operator-account.js`, order handlers, and source comments; `AIRTABLE_BASE_ID` is normally preferred |
| `tblzlPlaD5KbnE9XP` Forecasts & Insights/briefs | `ask-ai.js`, `ask-synthopulse.js`, `pre-shift-huddle.js` |
| `tblt4IDWrqDL9jg0S` Item Movement | Same AI/huddle sources |
| `tbl73d4esGTQcHg6c` External Factors | `ask-ai.js`, huddle source |
| `tbl2FbE1R7b2QesQE` Daily Sales | `ask-ai.js`, huddle source |
| `tblD56pucadUQj7TY` Menu Items | `ask-ai.js`, huddle source |
| `tblLSKZODdEi5X2un` Cost Source Items | AI/cost/proposal sources |
| `tblbQ2BwFHbHFnOht` Vendor Receipt Lines | Receipt/AI/proposal sources |
| `tblbdvzF3VUCQduj4` Receipt Cost Proposals | AI/proposal sources |
| `tblsWbZ1FJ92lqSo0` Inventory Items | Receipt cost proposals |
| `tblGIXGxnNb9kJIQ0` Cost Movement | Receipt cost proposals |
| `tbldpWvg1YHfuz2rq` Menu Item Ingredients | Receipt cost proposals |
| `tblonO1fBQNB0PhJU` Operator Users | `_auth.js`, `operator-account.js` |

## Named-table dependency groups

| Business area | Tables named in source | Key assumptions/effects |
| --- | --- | --- |
| Identity/tenant | Operator Users; Restaurants | Clerk ID/email maps to an active operator record with role, access flags, and `Restaurant Airtable Record ID` |
| Forecasting/order | Par Levels; Vendor Receipt Lines; Weekly Item Trends; Stock Count Lines; Cost Source Items; Menu Items; Item Movement; Daily Sales; Runs | Restaurant-linked records, count/reorder fields, and clean completed POS runs drive order/trend calculations |
| Receipts/costs | Vendor Receipts; Vendor Receipt Lines; Receipt Cost Proposals; Inventory Items; Cost Source Items; Cost Movement; Menu Item Ingredients | Receipt parse/review/proposal workflows write and link vendor/cost/inventory records; attachments are provider assets |
| Staffing | Staff Reliability Signals; staffing tables referenced by `staffing-board.js`/`shift-watch.js` | Staffing time and reliability fields are projected to operator views |
| Events/integrations | Event Intake Queue; External Factors; Integration Accounts | Event sources use source IDs/Tripleseat IDs, review/promotion state, restaurant context, and decision eligibility |
| Billing | Restaurants; Billing Profiles; Billing Invoices | Stripe identifiers/URLs are mirrored for internal operations; Stripe remains payment/invoice system of record |
| Stock counts | Stock Count Sessions; Stock Count Lines | Session/line linkage, operator identity, restaurant ID, review state, and attachment metadata are assumed |

## Source-visible field and relationship assumptions

- `_auth.js` relies on `Auth Provider User ID`, email, `Restaurant Name`, `Restaurant Airtable Record ID`, `Access Status`, role, and mobile/portal access fields. It backfills missing provider user IDs and requires a restaurant record ID.
- Order logic uses linked Restaurant, Ingredient, Inventory Items, Menu Item, and Stock Count Session relations; it depends on fields such as targets, reorder point, quantities, vendor/SKU/unit, status, and decision eligibility.
- Event workflows identify duplicates/updates through `External Event ID`, `Tripleseat Event ID`, or `Source Event ID`; promotion relies on event dates, status, review and demand-weight fields.
- Trend refresh selects clean `Runs` and `Daily Sales` by restaurant and completed POS reporting-run conditions, then upserts/deactivates Weekly Item Trends.
- Receipt parsing and review rely on Vendor Receipt/Line relationships, attachments, processing/review states, item/cost fields, and proposal links.

Field names are source labels, not durable field IDs. Field IDs, field types, formulas, rollups, lookups, views, interfaces, automations, sync configuration, permissions, and attachment files are not available in Git and require Airtable export/capture. No live schema/data was queried.

## Softr MCP schema overlay — 2026-08-28

A read-only Softr MCP archive now preserves the connected Airtable integration `422dc0ab-2509-4ef2-9930-2de87a8c902a` and base `appD303evZM2SlvMR` (`KitchenPulse`): 42 tables and 899 fields, with durable IDs, types, primary fields, select options, and linked-record metadata. See [Softr data-source export](../softr/mcp-export/data-sources.json).

This supplements the source-backed dependency map above; it does not replace source-derived route/relationship evidence. Records, attachment binaries, automations, scripts, views, interfaces, permissions, and provider history remain outside this schema capture.
