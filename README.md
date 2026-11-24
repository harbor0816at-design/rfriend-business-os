# Rfriend Business OS — OPPO Austria ERP

Production-linked ERP for Rfriend Services GmbH, based on the user's **approved Business OS v5 visual design**.

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
