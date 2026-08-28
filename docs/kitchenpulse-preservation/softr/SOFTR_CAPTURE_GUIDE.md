# Softr Capture Guide

Perform this page-by-page. Do not edit, publish, disable, or cancel anything while capturing.

> **Parked 2026-08-28:** KitchenPulse is retained on Softr Free. Manual capture is suspended; the 23 incomplete items are `DEFERRED_PROVIDER_PRESERVED`, meaning retained in Softr only and not externally preserved. Do not resume this procedure unless Softr announces deletion/retention changes or KitchenPulse migration resumes.

## Before starting

1. Create or identify the approved private archive for sensitive exports and attachments.
2. Create an internal Softr safety copy if permitted; record its URL, workspace, owner, date, and verification screenshot in the manifest.
3. Open `SOFTR_PRESERVATION_MANIFEST.md`; make one page register row per visible page and per hidden/helper page.

## Repeat for one Softr page at a time

1. Record page name, route/path, role/permission requirements, redirects, and query-string dependencies.
2. Take a full-page screenshot; save under `screenshots/` with the naming convention in the README.
3. In the builder, inspect every block in order. Record native/Vibe type, order, hidden state, data source, Airtable table, filters, sorting, visible fields, visibility, and navigation.
4. Inspect hidden blocks, forms, and action blocks explicitly. Treat them as possible engines for visible Vibe UI; record each action, Call API configuration, request mapping, success/error navigation, and side effect.
5. For each Vibe block, copy the **full current generated code** from **Content → Code** to `softr/vibe-code/current/` using the required filename. Preserve meaningful prior code versions in `softr/vibe-code/history/`.
6. Capture page-level custom code and record whether global code/theme also applies.
7. Add a screenshot/export checksum and source timestamp to the manifest, then mark only that evidence as captured.

## Once after page capture

- Capture app-level CSS/JavaScript, theme/style, assets, auth/user-group settings, domains/redirects, workflows, and integrations.
- Export or separately record Airtable schema/automations/attachments and Vercel source/configuration; this cannot be inferred from Softr screenshots.
- Redact secrets. A setting name, endpoint path, and variable name are useful; a token is not.

## Fast completeness check

The capture is incomplete if any page has no screenshot, any block has no entry, any Vibe block lacks current generated code, or any hidden/helper/action block is unaccounted for.

## Remaining after the MCP archive

Do **not** repeat MCP-covered capture. The human-only remainder is:

1. Recover listed page `/link-expired` (ID `4f0c2fde-ec1c-4954-9a91-c7c043ffd7c6`), whose page and permission reads return `NOT_FOUND`.
2. Capture the current Tripleseat Vibe source for block `c8eb0698-db61-4c7b-98c9-bb9347d88cde`; its source endpoint returns `NOT_FOUND`.
3. Resolve/rotate the sensitive literal redacted from Billing Vibe block `11cdca04-1d0c-4f83-8bab-26d44b4ea47a`; never store its value in Git.
4. Export the 11 native Custom Code block payloads omitted by the MCP.
5. Capture Studio-only theme/assets, navigation, global/page CSS/JS, auth/login/signup, redirects, published preview/screenshots, and the four access-control redirection rules.

## Final verification result — 2026-08-28

The destinations above were rechecked in the canonical checkout without accessing Softr. They do not yet contain supplied manual captures: `/link-expired` is still `NOT CAPTURED`, Tripleseat source is still a placeholder, all 11 native Custom Code files are placeholders, and `STUDIO_CONFIGURATION.md` remains `NOT CAPTURED`. The Billing handoff is correctly preserved only as `REDACTED_SENSITIVE_BILLING_VALUE`; no live Billing value is requested or stored.

Do not treat this guide or its scaffold paths as evidence that the capture occurred. The preservation gate therefore remains `NOT_SAFE_TO_ALLOW_SOFTR_DOWNGRADE`.

