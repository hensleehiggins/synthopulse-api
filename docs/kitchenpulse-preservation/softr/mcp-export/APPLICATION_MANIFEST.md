# KitchenPulse Softr MCP Export

Captured read-only from the Softr Workspace Preservation MCP on 2026-08-28.

## Application

- Workspace: `Hank` (`cbb15c96-86a7-427a-a5ee-5b0fea720149`)
- Application: `KitchenPulse Operator Portal` (`bd94ae5e-6d9d-4b3f-9a19-c52758d99cf8`)
- Production domain: `portal.synthopulse.ai`
- Softr subdomain: `tawnya81906.softr.app`
- Home page ID: `37f11de8-2142-448e-b135-f07dfdf8e067`
- Published timestamp: `2026-08-28T15:15:51`

## Coverage

- Pages listed: 26; pages readable in detail: 25; listed but unreadable: 1.
- Blocks read: 97 (47 VIBE, 46 NATIVE, 4 HELPER/HIDDEN).
- Vibe sources: 46 captured, 1 missing at source endpoint, 1 redacted for an embedded sensitive literal.
- Workflow inventory: 0 workflow(s).

## Files

- `application.json`, `pages.json`, `blocks.json`: raw provider objects.
- `access-control.json`: group and access-control inventory.
- `data-sources.json`: integrations, tables, and field schemas.
- `workflows.json`: workspace workflow listing.
- `vibe/`: one source file and one metadata file per Vibe block where obtainable.

## Page manifest

| Page | Page ID | Path | Type | Enabled | Blocks | Status |
| --- | --- | --- | --- | --- | ---: | --- |
| Receipt Intake | `088f12f8-8fd5-4634-a1c9-2ef5b1a47163` | `/receipt-intake` | USER | true | 7 | PRESERVED_MCP |
| Onboarding flow | `1603a120-ad20-454a-877b-99d756354614` | `/onboarding` | ONBOARDING_FLOW | true | 1 | PRESERVED_MCP |
| Today’s Brief | `17ff068d-4da8-48fc-bad8-4dcd8e47aa08` | `/todays-brief` | USER | false | 10 | PRESERVED_MCP |
| Account settings | `224e6efa-e6f0-46c8-ae77-daaa56054f03` | `/account` | USER_ACCOUNT | true | 2 | PRESERVED_MCP |
| Operator Accounts | `2be66c32-fde6-44fa-a81d-ba008b3482d1` | `/operator-accounts` | USER | true | 3 | PRESERVED_MCP |
| Sign up | `30dc92d9-fdb7-4180-95c5-58acebfd28e4` | `/sign-up` | SIGN_UP | true | 1 | PRESERVED_MCP |
| Home | `37f11de8-2142-448e-b135-f07dfdf8e067` | `/` | USER | true | 7 | PRESERVED_MCP |
| Page not found | `38850aa5-1f74-4c1e-a21e-9f80d1709a6f` | `/404` | PAGE_NOT_FOUND | true | 1 | PRESERVED_MCP |
| Reset password | `4d168ae5-ff7e-488d-88e5-be87c0c94a30` | `/reset-password` | RESET_PASSWORD | true | 1 | PRESERVED_MCP |
| Link expired | `4f0c2fde-ec1a-4954-9a91-c7c043ffd7c6` | `/link-expired` | LINK_EXPIRED | true | UNREADABLE | PRESERVED_MCP |
| What Changed | `5232e863-caa7-4c07-afb5-e043807313b8` | `/what-changed` | USER | true | 7 | PRESERVED_MCP |
| Cost Center | `71944de6-e78e-414c-9c8c-aebc6a973e58` | `/cost-center` | USER | true | 6 | PRESERVED_MCP |
| 9136419c-df18-45f2-8821-ed6fa6993b3a | `81d05baf-4d1b-4260-b576-44b61c712206` | `/c7cdf289-efa8-4e65-b64b-847b9b60db22` | SHARED_BLOCKS | true | 3 | PRESERVED_MCP |
| Hero Template - Stable | `90a379e9-a810-435e-8c1e-a28b693fdfdd` | `/home-copy` | USER | true | 10 | PRESERVED_MCP |
| Permission denied | `96839638-9ae9-489d-a7c4-890553aa809e` | `/401` | PERMISSION_DENIED | true | 1 | PRESERVED_MCP |
| Order Intelligence | `97ac6f46-2864-44b2-aa8d-5817ab5b97f5` | `/order-intelligence` | USER | true | 5 | PRESERVED_MCP |
| Forgot password | `a724f269-71e2-4d2e-afcb-e2d43de80aa1` | `/forgot-password` | FORGOT_PASSWORD | true | 1 | PRESERVED_MCP |
| Log in | `ac0bbc6f-7358-4837-b606-aeafe4a20a7a` | `/login` | LOG_IN | true | 1 | PRESERVED_MCP |
| Sales Dashboard | `b69ddb30-33e1-4138-a9e1-7a6bc4eed779` | `/sales-dashboard` | USER | true | 7 | PRESERVED_MCP |
| Billing | `c39b1da7-0061-49c7-a065-ccbc6c7e7e52` | `/billing` | USER | true | 3 | PRESERVED_MCP |
| KitchenPulse Receipt Capture | `cd42ee50-a41c-4407-8c6b-1528e2f67973` | `/mobile-receipt` | USER | true | 2 | PRESERVED_MCP |
| Add / Edit Local Event | `d2a43adf-e6de-4c3f-923d-2f367072ace8` | `/external-factors-details` | USER | true | 1 | PRESERVED_MCP |
| Tripleseat | `d764339b-545c-44c1-b3cb-07058aaaaf49` | `/tripleseat` | USER | true | 7 | PRESERVED_MCP |
| Events | `e2a0e2f1-9954-4577-a0c9-e0f1a3cf8751` | `/events` | USER | true | 5 | PRESERVED_MCP |
| Staffing | `f11c4dee-ec1c-42b7-9446-6fb063dad0cd` | `/staffing` | USER | true | 3 | PRESERVED_MCP |
| Forecasts & Insights details | `f8ef5505-c52a-46f0-a201-f837449ef011` | `/forecasts-insights-details` | USER | true | 2 | PRESERVED_MCP |

## Explicit gaps

- `/link-expired` is listed by Softr but both page and permission reads returned `NOT_FOUND`.
- The Tripleseat Vibe block `c8eb0698-db61-4c7b-98c9-bb9347d88cde` is listed but current source retrieval returned `NOT_FOUND`.
- Theme, navigation configuration, custom CSS/JS, redirects, auth-provider configuration, and global/page custom-code contents are not exposed by the read-only MCP calls used here.

