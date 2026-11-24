# Rfriend Business OS — OPPO Austria ERP

Production-linked ERP for Rfriend Services GmbH, based on the user's **final approved Business OS v3 HTML (`index (3).html`)**; it is a visual source of truth, not a database runtime.

## Production UI — accepted v3 layout

The final UI follows the uploaded `index (3).html`:
- Dark evergreen sidebar, six sections: Workspace, Sales & Fulfillment, Procurement & Inventory, Customer Service, Finance, Insights & Administration.
- Starred favorites separated from the sections, without duplicated links.
- Toggleable groups, pinned links, navigation search, quick navigation, visit-frequency ordering and Chinese/English labels.
- Original typography/colors/card/table/modal aesthetics, with business module pages powered by real Supabase data.
- The footer shows `Approved UI v3 · Supabase production · 2026-11-24` as a visible deployment marker.

**Release verification:** The GitHub files and JS syntax were checked; the linked Vercel connector still returns 404, so GitHub upload is verified but production deployment of this exact commit is **not** independently verified. Check Vercel Deployments for the latest `main` commit, and verify the footer marker. This should not be described as a fully accepted live release until the environment and user session pass acceptance tests.

## Applications
- **ERP:** https://rfriend-business-os.vercel.app/
- **GitHub:** https://github.com/harbor0816at-design/rfriend-business-os
- **Supabase project:** xcmmxstftxcmieakdbxf
- **ERP schema:** `erp`, separated from the existing OPPO Gallery's business tables.
- **Access:** Supabase email/password authentication, verified ERP `staff_roles`, RLS read policies, server-side role check and audit for writes.

## User-facing modules

The validated dark-green navigation and panel-based visual system covers:
- Dashboard and work tasks
- Order intake, import evidence, source reconciliation, and SKU dictionary
- Products, inventory stock, stock movement history
- Purchases, purchase lines, approval and physical warehouse receiving
- Sales orders, shipping records, manually entered shipping requests
- Returns, returns inspection, support tickets and support notes
- Used devices, used inspections and resale orders
- Finance: refund requests, approval ledger, receipts and invoices
- Reports, audit log, staff permissions, configuration, backup preview and IMEI registration

## Files

- `index.html` — authentication forms and layout.
- `app.js` — authenticated Supabase connection, password recovery, base data services.
- `full-ui.css` — approved demo visual theme.
- `full-ui.js` — expanded modules, navigation, actual tables, modals and workflow actions.
- `vercel.json` — static deployment and security headers.

## Verified database evidence

- 2,490 imported orders
- 3,095 imported source records
- 599 reconciliation cases
- 600 work tasks
- 38 monthly reporting rows

**Imported order face value is NOT recognized net revenue.** The formal products, invoices, device IMEIs, and some purchase/returns tables start empty, pending legitimate business inputs.

## Supported write endpoints (backend permissions and validation)

- `rfriend_erp_create_record` (8 supported entity types) and `rfriend_erp_bulk_create_records` (atomic chunks up to 100)
- `rfriend_erp_advance_status` (orders, tickets, tasks, purchase orders, returns)
- `rfriend_erp_purchase_add_line` and `rfriend_erp_receive_purchase_line`
- `rfriend_erp_create_manual_shipment` (existing warehouse request)
- `rfriend_erp_ticket_comment`
- `rfriend_erp_refund_request` and `rfriend_erp_refund_advance` (ledger only, no payment API calls)
- `rfriend_erp_register_imei` (quarantine only)
- `rfriend_erp_inspect_used_device` and `rfriend_erp_inspect_return`
- `rfriend_erp_staff_directory` and `rfriend_erp_assign_staff` (ERP admin only)

The production database transaction tests verified purchase creation → approval → receiving and used-device inspection under an authenticated ERP role; tests were rolled back.

## Limitations and important operational warnings

1. The UI is based on the approved demo rather than a literal copy of localStorage implementation: **production writes must not use the demo's browser-only storage**.
2. Bulk imports are currently CSV (not native .xlsx). The first-row header names must match ERP backend fields.
3. The combined UI does not yet cover every legacy demo workflow exhaustively: e.g. source-file reconciliation resolution actions, integrated shipping label purchasing, full inventory reservations/deductions on shipment, payment provider refunds, invoice-PDF creation, direct platform APIs, supplier settlements, and fully automatic backoffice imports remain to be integrated and validated.
4. User-authored business data should be verified in staging before real purchase fulfillment, physical stock updates or refund ledger transitions.
5. Backup download is an authenticated business JSON export, **not** a PostgreSQL disaster-recovery backup. Restore is preview-only to prevent accidental overwrites.
6. Do not commit service-role keys or passwords. The repository was seen as **public**; set visibility to private to keep ERP source internal.
7. Vercel deployment access via the current connector remains 404: **GitHub commits are confirmed, but actual production deployment of the latest commit must be checked in Vercel Deployments**.

## Production rollout checklist

- Verify Vercel connected to `harbor0816at-design/rfriend-business-os`, branch `main`, latest commit.
- Login as authorized ERP admin, refresh and verify full sidebar.
- Check orders, reporting, tasks and source reconciliation counts.
- Create a test SKU and draft purchase order *only in approved test mode*; do not mix testing with actual business operations.
- Confirm permissions for support, finance and warehouse staff.
- Finish external platform, warehouse and payment integrations before calling the entire ERP fully operational.

## Executive order pivot (2026-11-24)

The **经营总览 / Overview** now supports 5 fixed templates plus custom **row × column** cross-analysis across channel, series, model, category, order status and local order date. Time granularity supports **year / month / day**, with start/end dates, drill-down to individual orders, and CSV export. The database view `public.rfriend_erp_order_dimensions` preserves exactly one record per ERP order. Historical classification: 2,490 orders; 344 currently labelled `型号待核`, nine missing order dates. Historical orders with multi-product bundles count **one order**, not one sold unit per product. Unknown model classifications must never be silently guessed.

## Weekly warehouse reconciliation (2026-11-24)

The **库存管理 / Inventory** module supports:
- ERP weekly baseline snapshots (as of each Monday), current-week manual refresh, recent-week trend.
- Import independent stock observation for byrd/0815/office/used/physical (single and validated batch CSV).
- Cross-compare `warehouse × SKU × quality status × week`: ERP baseline vs independent observation; show `未核验`, matched, or delta.
- Manual adjustment requests with reason/evidence and **different verified user** admin/operations approval; server rechecks stock balance and reserved stock before a transactional ledger update.
- Audit entries and idempotent movement keys; changes only after approval.
- Weekly snapshot job: `cron.job` name `rfriend-erp-weekly-inventory`, `0 6 * * 1` in **UTC** (Monday morning, 07:00/08:00 Vienna depending on DST).
- Initial weekly snapshot: 207 balance lines with 2,221 on-hand units. External WMS/physical observations start **empty**: no false "all matched" claim.

The CSV template columns are `warehouse_code,sku,quality_status,source,observed_qty,reference`. External reports are only captured on upload; byrd/0815 connections are **not yet automatic**. Cron captures ERP stock weekly, not independent warehouse counts.

### Test evidence

Verified RLS-admin counts: 2,490 orders in the pivot and 207 weekly stock lines. A full two-user request → second-user approval → movement transaction test passed inside `BEGIN … ROLLBACK`. The test left **zero** adjustment requests and zero external count records.
