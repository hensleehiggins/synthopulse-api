# Preservation Verification

## Source checkpoint

| Component | State | Evidence | Restoration risk |
| --- | --- | --- | --- |
| Canonical Vercel source | `PRESERVED_EXTERNALLY` | GitHub remote `hensleehiggins/synthopulse-api`, commit `c9486bb`, plus fresh local checkout | Remote ownership/access must remain available |
| API route inventory | `PRESERVED_EXTERNALLY` | `vercel/VERCEL_API_INVENTORY.md`; 49 handlers plus shared auth helper | Runtime provider config still required |
| Runtime variable names | `PRESERVED_EXTERNALLY` | `vercel/ENVIRONMENT_MANIFEST.md`, names only | `REQUIRES_REAUTH_ON_RESTORE` for credentials/OAuth/secrets |
| Airtable source references | `PRESERVED_EXTERNALLY` | Base/table IDs/names and source assumptions in `airtable/AIRTABLE_DEPENDENCY_MAP.md` | Schema/data/formulas/attachments/automations are provider-only |
| Clerk authorization code | `PRESERVED_EXTERNALLY` | `_auth.js`, `operator-account.js`, package dependency | `REQUIRES_REAUTH_ON_RESTORE`; tenant config/keys/redirects not exported |
| Tripleseat/Google/OpenAI/Blob integration code | `PRESERVED_EXTERNALLY` | Tracked API handlers and dependency manifest | `REQUIRES_REAUTH_ON_RESTORE`; grants, webhooks, stored objects/configuration provider-only |
| Vercel project configuration | `REQUIRES_MANUAL_CAPTURE` | No `vercel.json`/`.vercel` metadata tracked | Domains, env values, cron/function settings unknown |
| Scheduled/background callers | `UNKNOWN` | Source exposes refresh/sync endpoints; no scheduler configuration tracked | Jobs may continue or fail after portal change |
| Airtable operational state | `PRESERVED_IN_PROVIDER` | Source points at base `appD303evZM2SlvMR`; no provider export performed | No external schema/data/attachment preservation evidence |
| Softr application/pages/blocks/Vibe code | `REQUIRES_MANUAL_CAPTURE` | No Softr artifacts in source repository | Cancellation could destroy unrecoverable UI/configuration IP |
| Softr safety copy/domains/billing | `REQUIRES_MANUAL_CAPTURE` | No provider evidence | Subscription/add-on/domain consequences unknown |
| Mobile application | `UNKNOWN` | A separate OneDrive Expo-style artifact was discovered but cloud files were unavailable; it is not this Git repository | Must obtain a usable checkout/export and identify its API/auth linkage |

## Cancellation gate

**NOT SAFE TO CANCEL Softr.** The API source is now preserved, but Airtable provider export/attachments, Vercel configuration, active scheduled callers, Clerk/provider configuration, and all Softr-only page/block/Vibe/theme/auth/workflow material remain uncaptured. No provider state was changed in this work.

## Read-only Softr MCP checkpoint — 2026-08-28

| Check | Result |
| --- | --- |
| App/page/block inventory | PASS — 26 pages listed, 25 detailed page reads, 97 block records |
| Vibe source/history | PARTIAL — 45 complete sources, 1 redacted-sensitive source, 1 `NOT_FOUND` source; 47 history lists |
| Access control | PARTIAL — six groups and aggregate counts; four redirection mappings not exposed |
| Data sources | PASS — Airtable 42 tables/899 fields; Softr database 3 tables/24 fields |
| Workflows | PASS — workspace listing returned 0 |
| Secret scan | PASS — no credential-shaped value in archived artifacts |
| Studio-only configuration/custom code | MANUAL_CAPTURE_REQUIRED |

The MCP calls were read-only; no production application, record, workflow, integration, or permission state changed.

## Final Softr preservation verification — 2026-08-28

This verification used only the canonical checkout; it made no Softr or production access.

| Check | Result |
| --- | --- |
| JSON validation | PASS — all 68 JSON files parsed with `JSON.parse` |
| MCP Vibe source archive | PARTIAL — 46 current source files; the 47th Tripleseat source still has only a manual placeholder |
| Native Custom Code archive | FAIL — all 11 expected files exist but retain their explicit manual-capture placeholders |
| Billing sensitive configuration | PASS — `REDACTED_SENSITIVE_BILLING_VALUE` only; restoration requires protected `BILLING_ADMIN_SECRET` outside Git |
| `/link-expired` | FAIL — still marked `NOT CAPTURED`; not documented as provider-owned/non-custom |
| Studio configuration | FAIL — theme, navigation, auth, redirects/domain, custom code, published state, and access-redirection mappings remain unrecorded |
| Preservation-path credential scan | PASS — no credential-shaped value found in the preservation archive |
| Git baseline before this report | PASS — clean branch `preservation/kitchenpulse-2026-08-28` tracking origin |

The full 47 Vibe sources, 11 Custom Code payloads, and Studio-only configuration are not reconstructible from the present checkout. The OAuth probe fixture literal `probe-secret` was detected only when scanning application source; it is a non-live test sentinel, lies outside the preservation archive, and was not changed under this documentation-only authorization.

## Final verdict

**NOT_SAFE_TO_ALLOW_SOFTR_DOWNGRADE**

Downgrading Softr now could credibly cause irrecoverable loss of the missing Tripleseat Vibe source, native Custom Code, and Studio-only configuration. This verdict does not depend on future Vercel migration work.

## Provider-retained parking supersession — 2026-08-28

The owner has chosen to retain KitchenPulse on Softr Free rather than delete it. The 23 incomplete manual-capture items are therefore `DEFERRED_PROVIDER_PRESERVED`: they remain in the Softr workspace/application only and are not represented as externally preserved here. This historical verification is not authorization for further capture or a new readiness assessment. Reopen only on a Softr deletion/retention-policy change or resumed KitchenPulse migration.
