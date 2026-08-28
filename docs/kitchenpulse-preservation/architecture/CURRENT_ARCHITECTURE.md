# Current Architecture

## Evidence basis

This document is derived from the tracked source at `c9486bb8c9a207732e7c4d670951dccacb292498` on `main` in `hensleehiggins/synthopulse-api`. The production URL appears in repository metadata as `https://project-1csz2.vercel.app`. Provider settings and live data were not inspected.

## System boundaries

| Area | Source-backed role | Evidence | Preservation state |
| --- | --- | --- | --- |
| Airtable | Operational record store and material business-logic surface | 49 Vercel handlers read/write Airtable; base `appD303evZM2SlvMR` is hard-coded as a fallback in several handlers and otherwise comes from `AIRTABLE_BASE_ID` | `PRESERVED_EXTERNALLY` for source references only; schema/data/automations/attachments remain provider-only |
| Vercel | Serverless API/action/integration layer | Tracked `api/` directory contains 49 handlers plus shared `_auth.js`; `package.json` and lockfile are tracked | `PRESERVED_EXTERNALLY` in Git checkout; project configuration/environment state remains provider-only |
| Softr | Operator presentation, bindings, actions, and permissions | Repository has no Softr export or page/block configuration | `REQUIRES_MANUAL_CAPTURE` |
| Clerk | Operator authentication and authorization | `@clerk/backend`; `_auth.js` verifies bearer tokens, resolves `Operator Users`, enforces active/access/role/restaurant checks; `operator-account.js` creates invitations | Source preserved; Clerk tenant/configuration remains provider-only and will require reauthorization/access on restore |
| OpenAI | AI brief, receipt-parsing, and huddle generation | `ask-ai`, `ask-synthopulse`, `pre-shift-huddle`, and receipt handlers call `api.openai.com` | Source preserved; key, billing, model access, and policy state are provider-only |
| Tripleseat | Event/lead integration and webhook/OAuth surface | 14 Tripleseat handlers, including OAuth callback, sync, probes, and `/api/tripleseat-webhook` | Source preserved; connection, OAuth grant, webhook registration and data remain provider-only |
| Google Business Profile | Event synchronization | `google-business-events-sync.js` uses Google OAuth and Business Profile API | Source preserved; refresh token, scopes, account/location configuration remain provider-only |
| Vercel Blob | Receipt/stock submission attachment staging | `@vercel/blob` and blob token variables in intake/mobile/stock handlers | Source preserved; stored blobs and token remain provider-only |
| Stripe | Billing/invoice system of record | `billing-command-center.js` explicitly identifies Stripe as the invoice/payment system of record, while mirroring internal operations to Airtable | Source reference preserved; Stripe account/configuration/data are provider-only |

## Role classification

| Role | Confirmed components |
| --- | --- |
| System of record | Airtable for operational records; Stripe for payments/invoices as stated in billing source |
| Business logic | Airtable formulas/automations (not exported), Vercel API handlers, and custom server-side transformations |
| Presentation/UI | Softr portal (not captured); a separate local Expo mobile artifact exists at `C:\Users\Geesh\OneDrive\Documents\kitchenpulse-operator`, but its OneDrive provider was unavailable and it is not a usable Git checkout |
| Authentication | Clerk bearer-token verification plus Airtable `Operator Users` authorization record |
| Integration/synchronization | Airtable, OpenAI, Tripleseat, Google Business Profile, Vercel Blob, Stripe-linked billing records |
| Scheduled/background work | No `vercel.json`, Vercel cron declaration, workflow, or job script is tracked. Source exposes callable refresh/sync endpoints; whether Vercel, Zapier, Airtable Automations, or an external scheduler invokes them is provider-only/unknown |

## Authorization and tenant boundary

`api/_auth.js` maps a verified Clerk subject/email to `Operator Users`, checks `Access Status`, mobile/portal access, role, and `Restaurant Airtable Record ID`. The restaurant record ID is the visible tenant-boundary key. Some older/utility handlers do not import this helper; their effective production protection must be verified by route-level source review and provider configuration before restoration.

## High-risk dormant-state dependencies

- Airtable attachment retention, tables/fields/formulas, automations, interfaces, and permissions are not in Git.
- Softr pages, block code/configuration, hidden helper blocks, themes, actions, and user-group permissions are absent from Git.
- OAuth grants/refresh tokens, Clerk keys/configuration, Vercel environment values, Blob storage, and provider-side webhook registrations can expire or be revoked while dormant.
