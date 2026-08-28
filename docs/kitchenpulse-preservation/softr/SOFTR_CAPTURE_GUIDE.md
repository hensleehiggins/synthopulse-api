# Softr Capture Guide

Perform this page-by-page. Do not edit, publish, disable, or cancel anything while capturing.

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




