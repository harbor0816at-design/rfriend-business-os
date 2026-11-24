# Rfriend Business OS — Live ERP Portal

First production integration slice for OPPO Austria / Rfriend Services GmbH.

## Project architecture

- **Vercel project:** `rfriend-business-os` (separate from existing Gallery site).
- **Supabase backend:** OPPO Gallery, project `xcmmxstftxcmieakdbxf` in Frankfurt.
- **Auth:** Supabase Auth with ERP-scoped `erp.staff_roles`.
- **Access policy:** Authorized employees only; read access via `public.rfriend_erp_*` `security_invoker` views with RLS.
- **Manual shipment request:** A validated RPC creates a pending warehouse approval request; it does **not** deduct inventory or mark delivery.
- **Public Supabase key:** `sb_publishable_*` is a publishable client identifier, **not a secret**.

## Included functionality

1. Email/password employee login, session refresh, role gate.
2. Live historical orders with order and creation timestamps; search and pagination.
3. Dashboard with imported order counts, face value and outstanding tasks.
4. Monthly / channel sales-order report and CSV export.
5. Role-filtered work tasks.
6. Manual shipping request with idempotency key, warehouse choice and tracking number.

## Important limitations before broad launch

- This is phase one, **not** the full ERP v5 feature set.
- Historic imported order face value is **not** confirmed net revenue.
- No live procurement, stock adjustment, refunds or bulk import yet.
- Shipment requests require subsequent warehouse confirmation and do not adjust inventory.
- No unreviewed service-role key or other secrets may ever be committed.
- Validate production authentication, allowed redirect domains, RLS, and access controls before handling real customer operations.
- The repository is currently **public**. Change it to **private** in GitHub settings for business source-code confidentiality.

## Vercel

Connect `harbor0816at-design/rfriend-business-os` to the existing `rfriend-business-os` Vercel project via **Settings → Git**.
Use the repository root, production branch `main`. Static deployment requires no environment variables: public endpoint and publishable key are embedded in `app.js`.
Do not connect this repository to the existing Gallery Vercel project.

## Backend

The database migrations and initial ERP role were applied in Supabase in prior steps. No database setup or credentials are included here.
