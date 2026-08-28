# Airtable Dependency Map

## MCP-backed schema inventory

The read-only Softr MCP exposes the connected Airtable integration `422dc0ab-2509-4ef2-9930-2de87a8c902a` and base `appD303evZM2SlvMR` (`KitchenPulse`). It returned **42 tables and 899 fields**, including durable IDs, names, types, primary fields, select options, and linked-record references. The full machine-readable export is [../softr/mcp-export/data-sources.json](../softr/mcp-export/data-sources.json).

## Reconciliation discrepancy

This document previously claimed that no Airtable evidence was available. That statement is superseded by the MCP capture. It remains true that this export is schema-only: records, attachment binaries, automations, interfaces, scripts, views, permissions, and provider audit history are not captured here.

## Source-aligned dependencies

The source checkout’s architectural inventory identifies the same base ID and names operational tables such as `Operator Users`, `Restaurants`, `External Factors`, `Forecasts & Insights`, `Vendor Receipts`, `Event Intake Queue`, and billing-related tables. Use the detailed schema JSON as the durable ID reference and treat any source-to-table mapping absent from `RECONSTRUCTION_MAP.md` as `UNKNOWN`.

