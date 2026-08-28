# Environment Manifest

## Scope

These are environment-variable **names** found in tracked JavaScript at commit `c9486bb`. There is no tracked Vercel configuration or build-time variable declaration, so all are treated as runtime dependencies. Values were neither read nor recorded.

| Variable name(s) | Source use | Provider/purpose | Dormant restore risk |
| --- | --- | --- | --- |
| `AIRTABLE_BASE_ID`, `KITCHENPULSE_AIRTABLE_BASE_ID`, `KITCHENPULSE_BASE_ID` | Most handlers; tenant/data access | Airtable base locator | Base access/ID mapping must be verified |
| `AIRTABLE_PAT`, `AIRTABLE_TOKEN`, `AIRTABLE_API_KEY`, `KITCHENPULSE_AIRTABLE_API_KEY`, `AIRTABLE_PERSONAL_ACCESS_TOKEN` | Most Airtable handlers | Airtable credential aliases | Rotate/reauthorize likely; preserve name-to-scope/owner only |
| `AIRTABLE_CHLOES_RESTAURANT_ID`, `KITCHENPULSE_DEFAULT_RESTAURANT_ID`, `KITCHENPULSE_RESTAURANT_ID`, `RESTAURANT_RECORD_ID` | `_auth`, order, receipt, event, sync handlers | Airtable tenant/default restaurant record locator | Record must still exist; verify tenant mapping |
| `AIRTABLE_OPERATOR_USERS_TABLE`, `AIRTABLE_APP_USAGE_EVENTS_TABLE` | `_auth`, app usage | Airtable table names/IDs | Schema must be restored/verified |
| `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `CLERK_INVITE_REDIRECT_URL` | `_auth`, `operator-account` | Clerk token verification, user lookup, invitations | Keys/configuration may rotate; redirect/origin must be recaptured |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_RECEIPT_MODEL` | Ask AI, huddle, receipt handlers | OpenAI authentication/model selection | Key/billing/model availability may change |
| `BLOB_READ_WRITE_TOKEN`, `BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN` | Receipt intake/mobile and stock submit | Vercel Blob storage | Token/storage access must be restored; blob retention needs export check |
| `BILLING_ADMIN_SECRET` | Billing command center | Billing action guard | Rotate/retain privately; validate route protection |
| `KITCHENPULSE_AUTOMATION_SECRET` | Operator account | Automation-origin action guard | Rotate/retain privately; identify automation caller |
| `ADMIN_REFRESH_SECRET` | Movement-cost and weekly-trend refresh | Manual/scheduled refresh guard | Identify scheduler and rotate/restore secret |
| `STOCK_COUNT_MAX_LINES`, `STOCK_COUNT_MAX_QUANTITY` | Stock count submit | Runtime validation limits | Preserve values as non-secret operational config in private configuration record |
| `GOOGLE_BUSINESS_ACCOUNT_ID`, `GOOGLE_BUSINESS_LOCATION_ID` | Google Business event sync | Google target account/location | Account/location permissions must be restored |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_BUSINESS_SYNC_SECRET` | Google Business event sync | Google OAuth and sync trigger guard | Refresh token and consent may expire/revoke; reauthorization likely |
| `TRIPLESEAT_API_BASE_URL`, `TRIPLESEAT_API_KEY` | Probe/sync/env check | Tripleseat API connection | Credential/endpoint account access must be verified |
| `TRIPLESEAT_AUTH_URL`, `TRIPLESEAT_TOKEN_URL`, `TRIPLESEAT_CLIENT_ID`, `TRIPLESEAT_CLIENT_SECRET`, `TRIPLESEAT_REDIRECT_URI`, `TRIPLESEAT_SCOPE` | OAuth/auth/callback/probe routes | Tripleseat OAuth | Consent, redirect registration, client secret, and scopes require restoration review |
| `TRIPLESEAT_LOCATION_ID`, `TRIPLESEAT_WEBHOOK_SECRET` | Event/lead sync and env check | Tripleseat location and webhook validation | Provider configuration/secret must be recaptured |

## Source files with dynamic alias lookups

Several routes use `getEnv(name, aliases)` rather than literal property access. The aliases above include source-visible `AIRTABLE_PERSONAL_ACCESS_TOKEN` and `KITCHENPULSE_BASE_ID`. Provider-side Vercel settings may contain additional unused/legacy names; export that name-only inventory before cancellation.

## Build versus runtime

No build script, frontend bundle, or Vercel config in this repository consumes an environment variable. The source evidence is runtime serverless access. That does not prove Vercel has no build-time settings; the Vercel dashboard must be checked.
