# Softr Preservation Manifest

Softr is not assumed to provide an independently deployable application-source export. This manifest is a provider-side capture checklist; nothing here confirms that any Softr artifact has been captured yet.

## Application-level capture

| Item | Status | Evidence path/reference | Notes |
| --- | --- | --- | --- |
| App identity, workspace, owner, plan, and billing add-ons | `REQUIRES_MANUAL_CAPTURE` | — | Include custom domain/add-ons |
| Theme/style configuration and global assets | `REQUIRES_MANUAL_CAPTURE` | — | Capture settings and original asset files |
| App-level custom CSS/JavaScript | `REQUIRES_MANUAL_CAPTURE` | — | Preserve full current text |
| Authentication settings and Clerk relationship | `REQUIRES_MANUAL_CAPTURE` | — | Capture redirects, provider choices, claims/groups |
| User groups, permissions, and visibility rules | `REQUIRES_MANUAL_CAPTURE` | — | Include default/anonymous behavior |
| Redirects, domains, navigation, and page list | `REQUIRES_MANUAL_CAPTURE` | — | Include query-string behavior |
| Workflows, Call API actions, and webhooks | `REQUIRES_MANUAL_CAPTURE` | — | Redact secrets; preserve configuration names/URLs |
| Internal safety-copy/duplicate app | `REQUIRES_MANUAL_CAPTURE` | — | Record duplicate app URL/owner without credentials |

## Page and block register

Create one entry per page and every block, including hidden blocks and helper/action engines. Add additional rows; do not collapse repeated blocks.

| Page name | Route/path | Block order | Block name/ID | Block type | Visible/hidden | Data source/table | Filters/sort/fields | Actions/Call API | Visibility/user groups | Navigation/query dependencies | Custom/page code | Vibe-code archive | Evidence/status |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No pages discovered locally | — | — | — | — | — | — | — | — | — | — | — | — | `REQUIRES_MANUAL_CAPTURE` |

## Vibe Coding archive convention

For **every** Vibe Coding block, export the full current generated code from **Softr Content → Code**. Store it under:

`softr/vibe-code/current/<page-slug>__<route-slug>__block-<order>-<block-slug>__current.<ext>`

Use `softr/vibe-code/history/<page-slug>__<route-slug>__block-<order>-<block-slug>__YYYY-MM-DD.<ext>` for important prior versions. For every export, record the Softr page/block identity, capture date, operator, source location, checksum, and whether code was copied in full. If the code includes secrets, store a private encrypted original and keep only a redacted checksum reference here.

## Non-Git dependency register

Capture any data binding, filter, permission, block setting, theme asset, domain setting, workflow, integration, or provider configuration that is not represented in the eventual Git source. Mark it `UNKNOWN` until evidence is attached.

## Latest read-only MCP export — 2026-08-28

The current Softr state is archived in [mcp-export/APPLICATION_MANIFEST.md](mcp-export/APPLICATION_MANIFEST.md): application/page/block/access-control/data-source/workflow JSON plus individual Vibe sources and metadata.

- App: `KitchenPulse Operator Portal` (`bd94ae5e-6d9d-4b3f-9a19-c52758d99cf8`), `portal.synthopulse.ai`.
- 26 pages listed; 25 readable. `/link-expired` is listed but returns `NOT_FOUND`.
- 97 readable blocks; 47 Vibe blocks; 45 unredacted current sources; 1 redacted; 1 unavailable.
- 0 Softr workflows returned in the workspace listing.

No write-capable Softr operation was invoked.



