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


## Password recovery (Supabase Auth)

The sign-in page includes **Forgot password / 忘记密码**. It sends a recovery email using `POST /auth/v1/recover?redirect_to=<current ERP origin>/?action=reset-password`. The callback checks the one-time recovery access token at `GET /auth/v1/user`, then changes the password with `PUT /auth/v1/user`, and returns to sign-in without persisting that recovery token.

**Required one-time configuration in Supabase Dashboard:**

1. Open **Authentication → URL Configuration** in Supabase project `xcmmxstftxcmieakdbxf`.
2. Under **Redirect URLs**, add the exact production URL pattern for the deployed ERP app: `https://YOUR-ACTUAL-ERP.vercel.app/**` (replace the placeholder with the verified deployment host).
3. If/when adding the production domain, also allow `https://erp.opporfriend.com/**`.
4. Leave the existing Gallery **Site URL** and redirect URLs untouched.
5. Test a recovery email from ERP. The recovery link must return to ERP and the password form must appear. Verify successful sign-in with the new password and normal ERP RLS permissions.

Do not add a broad `https://*.vercel.app/**` allowlist in production. Supabase SMTP email delivery and quotas may need separate setup. Never paste passwords or recovery links into chat, issue trackers, or logs.
