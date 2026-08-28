# KitchenPulse Preservation Package

**Purpose:** preserve reconstruction evidence before KitchenPulse is placed in a dormant state. This package is documentation and capture scaffolding only; it does not change any provider configuration, credentials, records, APIs, or subscriptions.

## Evidence boundary

The original preservation workspace was empty. This package was then merged into a fresh local checkout of the verified canonical source: `https://github.com/hensleehiggins/synthopulse-api.git`, branch `main`, commit `c9486bb8c9a207732e7c4d670951dccacb292498`. Repository-derived inventories now reflect that checkout. Provider-only information—including Airtable schema/data, Vercel settings, and Softr configuration—still requires direct evidence before it may be called preserved.

## Contents

| Location | Contents |
| --- | --- |
| `architecture/` | Current system-boundary record |
| `airtable/` | Source-derived Airtable dependency map |
| `vercel/` | Server/API and environment inventories |
| `softr/` | Manual capture manifest, guide, and Vibe-code archive convention |
| `api-contracts/` | Reserved for request/response captures obtained from source or provider evidence |
| `integrations/` | Reserved for provider export evidence and reauthorization records |
| `screenshots/` | Page screenshots, named by route and capture date |
| `migration/` | Documentation-only reconstruction map |
| `verification/` | Preservation verification matrix and parking checklist |

## Capture evidence rules

- Never place secret values, session cookies, API tokens, database exports containing sensitive data, or `.env` files in this repository.
- Store originals where possible; record the source URL/app, capture date, operator, and a SHA-256 checksum alongside each export.
- If content contains personal, merchant, staffing, or operational data, place it in the approved private archive and record only its checksum/path reference here.
- `UNKNOWN` means no evidence was available. Do not convert it to a positive status based on memory or expected architecture.

## Recommended capture naming

`<surface-slug>__<route-slug>__<artifact>__YYYY-MM-DD.<ext>`

Examples: `ops-dashboard__root__full-page__2026-08-28.png` and `staffing__staffing__vibe-code-current__2026-08-28.js`.

See `softr/SOFTR_CAPTURE_GUIDE.md` before doing provider-side capture. No provider-side actions have been performed by this package.



