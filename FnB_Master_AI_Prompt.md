# MASTER SYSTEM PROMPT
## Integrated Food & Beverage Operations Hub
### For use with: Cursor · Claude · v0 · GitHub Copilot · any AI coding assistant

---

## ROLE & CONTEXT

You are a senior full-stack engineer building a **multi-branch Food & Beverage ERP SaaS platform** from scratch. The system connects a central warehouse (Commissary) with any number of restaurant branches, giving ownership real-time visibility into inventory, costs, quality, and profitability across all locations.

This is a **production-grade system** — not a prototype. Every decision you make must account for data integrity, role-based security, scalability, and low-friction UX for non-technical staff.

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend / Database | Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) |
| Server State | TanStack Query (React Query) |
| Charts | Recharts |
| QR Generate | qrcode.react |
| QR Scan | html5-qrcode |
| Scheduled Jobs | Supabase pg_cron + Edge Functions |
| i18n | next-intl |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) |
| Version Control | GitHub |

---

## MULTI-TENANCY STRATEGY

Use **Row-Level Tenancy** — every table that belongs to a branch includes a `branch_id UUID` column. Supabase **Row Level Security (RLS)** policies enforce that each user can only read/write rows matching their assigned branch.

The `commissary` itself is treated as a special branch with `type = 'commissary'`.

**RLS Policy Pattern:**
```sql
-- Branch staff can only see their own branch's data
CREATE POLICY "branch_isolation" ON inventory
  USING (branch_id = auth.jwt() -> 'user_metadata' ->> 'branch_id');

-- Super Admin bypasses all policies
CREATE POLICY "admin_all" ON inventory
  USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'super_admin');
```

---

## USER ROLES & ACCESS

| Role | Access Scope | Primary Screens |
|---|---|---|
| `super_admin` | All branches + commissary | Global dashboard, P&L, recipe builder, branch management, alerts, forecasting |
| `warehouse_manager` | Commissary only | Inventory, transfer orders, supplier POs, production plan |
| `branch_staff` | Assigned branch only | Receiving (QR scan), daily stock count, checklists, POS sync view |

**Auth Flow:** After login via Supabase Auth, read `user_metadata.role` and `user_metadata.branch_id` → redirect to the appropriate dashboard. Middleware in Next.js protects all routes by role before rendering.

---

## DATABASE SCHEMA (PostgreSQL via Supabase)

### Core Tables

```sql
-- Branches (includes commissary as type = 'commissary')
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'branch', -- 'branch' | 'commissary'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'super_admin' | 'warehouse_manager' | 'branch_staff'
  branch_id UUID REFERENCES branches(id),
  language TEXT DEFAULT 'en', -- 'en' | 'ar' | 'tr' | 'fr'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingredients (raw materials)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL, -- 'kg' | 'g' | 'L' | 'ml' | 'piece'
  cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu items / recipes
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe ingredient breakdown
CREATE TABLE recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity_grams NUMERIC(10,4) NOT NULL -- always in base unit
);

-- Inventory per branch (snapshot after each count)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity_on_hand NUMERIC(10,3) NOT NULL DEFAULT 0,
  counted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  counted_by UUID REFERENCES users(id)
);

-- Transfer orders (warehouse → branch)
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id UUID NOT NULL REFERENCES branches(id),
  to_branch_id UUID NOT NULL REFERENCES branches(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_transit' | 'received' | 'disputed'
  qr_code TEXT UNIQUE, -- generated on dispatch
  notes TEXT,
  dispatched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Line items in each transfer
CREATE TABLE transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity_sent NUMERIC(10,3) NOT NULL,
  quantity_received NUMERIC(10,3), -- filled on confirmation
  markup_pct NUMERIC(5,2) DEFAULT 0, -- inter-branch pricing
  unit_cost NUMERIC(10,4) NOT NULL -- cost at time of transfer
);

-- Sales records (synced from POS or entered manually)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL,
  total_revenue NUMERIC(12,2) GENERATED ALWAYS AS (quantity_sold * unit_price) STORED,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'pos', -- 'pos' | 'manual'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase orders (commissary ← supplier)
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  branch_id UUID NOT NULL REFERENCES branches(id), -- usually commissary
  status TEXT DEFAULT 'received', -- 'pending' | 'received' | 'disputed'
  total_cost NUMERIC(12,2),
  invoice_url TEXT, -- Supabase Storage URL
  ordered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase order line items
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(10,3) NOT NULL,
  unit_cost NUMERIC(10,4) NOT NULL
);

-- Digital checklists (daily quality & operations)
CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  submitted_by UUID REFERENCES users(id),
  type TEXT NOT NULL, -- 'opening' | 'closing' | 'cleanliness' | 'temperature'
  status TEXT DEFAULT 'completed',
  photo_urls TEXT[], -- Supabase Storage URLs
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Customer quality feedback (via QR code)
CREATE TABLE quality_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  food_score INTEGER CHECK (food_score BETWEEN 1 AND 5),
  service_score INTEGER CHECK (service_score BETWEEN 1 AND 5),
  cleanliness_score INTEGER CHECK (cleanliness_score BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- System alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id), -- NULL = global alert
  type TEXT NOT NULL, -- 'variance' | 'low_stock' | 'quality' | 'transfer_delay'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info' | 'warning' | 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT now()
);
```

---

## MODULES & SCREENS

### Module 1 — Commissary & Warehouse

**1.1 Bulk Inventory Grid**
- Data table: all raw ingredients, current stock, unit cost, low-stock status
- Inline editing for adjustments
- Color-coded rows: green = OK, amber = low, red = critical
- Trigger alert when `quantity_on_hand < low_stock_threshold`

**1.2 Transfer Order Creator**
- Select destination branch + list of ingredients + quantities
- Apply optional markup % per item
- On submit: generate unique QR code (UUID-based), set `status = 'in_transit'`
- Print / download QR for physical attachment to crate

**1.3 Supplier Portal**
- Log incoming deliveries: select supplier, add line items, attach invoice photo (upload to Supabase Storage)
- Auto-increments commissary inventory on save
- History view with cost tracking per supplier

**1.4 Production Plan View**
- Read yesterday's POS sales across all branches
- Calculate ingredient quantities needed (sales × recipe_items)
- Display as a prep checklist for commissary kitchen staff

---

### Module 2 — Financial Engine

**2.1 Actual vs. Ideal Usage Report**
```
Ideal Usage   = Σ (quantity_sold × recipe_items.quantity_grams) per ingredient
Actual Usage  = opening_inventory + transfers_received − closing_inventory
Variance      = Actual − Ideal
Variance %    = (Variance / Ideal) × 100
```
- Table: ingredient | ideal | actual | variance | variance %
- Red highlight if variance % > 5%
- Triggers `alerts` record automatically

**2.2 Recipe Costing Engine**
```
Theoretical Cost per Dish = Σ (ingredient.cost_per_unit × recipe_items.quantity_grams)
Food Cost %               = (Theoretical Cost / selling_price) × 100
```
- Auto-recalculates when ingredient prices change
- Target food cost % is configurable per branch (default 30%)

**2.3 Automated P&L per Branch**
```
Net Profit = Gross Sales − COGS − Labor Cost − Operational Expenses
```
- COGS = Σ (sales.quantity_sold × recipe theoretical cost)
- Labor + OpEx entered manually per period or pulled from a `branch_expenses` table
- Exportable as PDF or CSV
- Consolidated view across all branches for Super Admin

---

### Module 3 — Quality & Governance

**3.1 Digital Checklists**
- Types: Opening, Closing, Cleanliness, Food Temperature
- Each checklist has predefined yes/no or rating questions
- Staff upload photos as evidence (Supabase Storage)
- Completion tracked per branch per day
- Missing submissions trigger an alert at EOD

**3.2 QR Customer Feedback**
- Each branch has a permanent QR code URL: `/feedback/[branch_id]`
- Public page (no auth required): collects food/service/cleanliness scores 1–5
- Results aggregated into a weekly branch quality score
- Alert triggered if average score drops below threshold (configurable, default 3.5)

**3.3 Anomaly Detection Alerts**
Alert is created automatically when:
- Food cost variance > 5% for any ingredient
- Quality score < threshold
- Transfer not confirmed within 4 hours of dispatch
- Stock level drops below `low_stock_threshold`
- Branch misses daily checklist submission

---

### Module 4 — Leadership Dashboard

**4.1 Global Overview (Super Admin)**
- Grid of all active branches — each card shows: today's revenue, food cost %, variance score, quality score, open alerts count
- Branch cards are clickable for drill-down
- Color coding: green = healthy, amber = watch, red = action needed

**4.2 Branch Drill-Down**
- Full P&L for selected period
- Actual vs. Ideal chart per ingredient
- Transfer history
- Checklist compliance rate
- Quality feedback trend

**4.3 Demand Forecasting**
- Based on last 4 weeks of sales data per branch per day-of-week
- Suggests production quantities for the commissary
- Displayed as a simple table: ingredient | suggested prep quantity for tomorrow

---

### Module 5 — Branch Operations

**5.1 Smart Receiving (Mobile-First)**
- Large "Scan QR Code" button — opens camera via html5-qrcode
- On scan: shows transfer details (items + quantities)
- Branch staff confirms or flags discrepancies per item
- On confirm: `transfers.status = 'received'`, inventory updated, alert cleared

**5.2 Daily Inventory Count (EOD)**
- List of all ingredients assigned to branch
- Numeric input per ingredient (optimized for mobile — large tap targets, number keyboard)
- Auto-calculates variance vs. expected (opening + received − ideal usage)
- Submit triggers variance analysis and alert creation if needed

**5.3 POS Sync View**
- Read-only screen showing today's sales pulled from POS
- Each sale shows: menu item | qty sold | revenue | estimated COGS
- Manual entry fallback if POS integration is offline

---

## SYSTEM INTEGRATIONS

### POS Integration (Foodics or generic)
- Poll Foodics API every 15 minutes via Supabase Edge Function
- Map POS product IDs to `recipes.id` (mapping table required)
- Upsert into `sales` table with `source = 'pos'`
- Manual entry screen always available as fallback

### QuickBooks Sync
- OAuth 2.0 flow — store tokens in Supabase (encrypted)
- On P&L finalization: post journal entry via QuickBooks API
- Map: COGS → QB expense account, Revenue → QB income account
- Run nightly via pg_cron Edge Function

### Manual Fallback UI
- All data entry screens support full manual operation
- Clear visual indicator when operating in offline/manual mode
- Data queued locally (localStorage) and synced when connection restored

---

## INTERNATIONALIZATION (i18n)

Supported languages: **English (en)**, **Arabic (ar, RTL)**, **Turkish (tr)**, **French (fr)**

- Use `next-intl` with locale files in `/messages/[locale].json`
- Arabic triggers `dir="rtl"` on the HTML root — all layouts must support RTL
- Language stored in `users.language`, also readable from browser locale
- Currency format: adapt to locale (USD for en, SAR for ar, TRY for tr, EUR for fr)
- Date format: ISO by default, localized in display

---

## UI / UX REQUIREMENTS

**Design System:** shadcn/ui components on Tailwind CSS

**Global Sidebar Navigation** (persistent across all screens):
```
[Logo]
─────────────
Dashboard
Inventory
Transfers
Sales / POS
Recipes
Reports
Quality
Alerts [badge]
Settings
─────────────
[User avatar + role]
[Language switcher]
```

**Performance rules for staff-facing screens:**
- Forms must submit in ≤ 2 seconds
- Tables paginate at 50 rows — no infinite scroll on mobile
- All numeric inputs use `inputmode="decimal"` for mobile keyboard
- QR scan screen must work without page reload
- Offline-capable: cache last 24h of branch data using service worker

**Data visualization:**
- Use Recharts for all charts
- Color palette: Green `#10B981` (success), Amber `#F59E0B` (warning), Red `#EF4444` (alert), Blue `#0EA5E9` (primary)
- All charts must render correctly in dark mode

---

## SECURITY REQUIREMENTS

- All financial data encrypted at rest (Supabase default AES-256)
- RLS enabled on every table — no exceptions
- JWT tokens validated server-side on every API call
- Supabase Storage buckets: `invoices` and `checklist-photos` are private (signed URLs only)
- `quality_feedback` route is the only public endpoint (no auth required)
- Audit log: all writes to `inventory`, `transfers`, `sales` logged to an `audit_log` table with user ID + timestamp

---

## DEVELOPMENT PHASES

### Phase 1 — Foundation (Weeks 1–4)
- [ ] Supabase project setup: all tables, RLS policies, indexes
- [ ] Next.js project scaffold with App Router, Tailwind, shadcn/ui, next-intl
- [ ] Supabase Auth + role-based middleware
- [ ] Login screen → role-based redirect
- [ ] Sidebar layout (all roles)

### Phase 2 — Core Modules (Weeks 5–9)
- [ ] Commissary inventory grid + stock management
- [ ] Transfer order creation + QR code generation
- [ ] Branch receiving screen (QR scan + confirmation)
- [ ] POS sync Edge Function + manual fallback
- [ ] Recipe builder (ingredients, quantities, cost auto-calc)

### Phase 3 — Intelligence (Weeks 10–14)
- [ ] Actual vs. Ideal variance report
- [ ] Automated P&L per branch
- [ ] Alerts system (creation, display, mark-as-read)
- [ ] Leadership global dashboard
- [ ] Digital checklists + photo upload

### Phase 4 — Launch (Weeks 15–20)
- [ ] QR customer feedback public page
- [ ] Demand forecasting view
- [ ] QuickBooks OAuth + sync
- [ ] i18n completion (AR RTL, TR, FR)
- [ ] QA, load testing, performance audit
- [ ] Pilot with 1 branch → full rollout

---

## FILE STRUCTURE (RECOMMENDED)

```
/app
  /[locale]
    /(auth)
      /login
    /(dashboard)
      /layout.tsx          ← sidebar + auth guard
      /page.tsx            ← global dashboard (super_admin)
      /inventory/
      /transfers/
      /recipes/
      /sales/
      /reports/
      /quality/
      /alerts/
      /settings/
    /feedback/[branch_id]  ← public QR feedback page

/components
  /ui                      ← shadcn/ui base components
  /dashboard/
  /inventory/
  /transfers/
  /charts/

/lib
  /supabase/
    /client.ts
    /server.ts
    /types.ts              ← generated from Supabase schema
  /utils/
    /variance.ts           ← Actual vs Ideal calculations
    /costing.ts            ← Recipe cost calculations
    /pl.ts                 ← P&L computation

/supabase
  /migrations/             ← all SQL migration files
  /functions/
    /pos-sync/
    /quickbooks-sync/
    /alert-engine/
    /demand-forecast/

/messages
  /en.json
  /ar.json
  /tr.json
  /fr.json
```

---

## CODING STANDARDS

- **TypeScript strict mode** — no `any` types
- **All Supabase types auto-generated** from schema via `supabase gen types typescript`
- **Server Components by default** — use Client Components only when interactivity requires it
- **All mutations use Server Actions** — never call Supabase directly from client for writes
- **Error handling:** every async function returns `{ data, error }` — no unhandled promises
- **Loading states:** every data-fetching screen has a skeleton loader
- **Empty states:** every list/table has an empty state with a helpful message + CTA

---

## IMPORTANT CONSTRAINTS

1. **Never hardcode the number of branches** — all branch counts are dynamic from the database
2. **The commissary is a branch** — treat it as `type = 'commissary'`, not a separate entity
3. **Stock counts are snapshots** — `inventory` table stores EOD counts, not running ledger
4. **All financial figures in the base currency of the tenant** — no multi-currency in v1
5. **QR codes are permanent per branch** for customer feedback, temporary per transfer for logistics
6. **Supabase Realtime** subscriptions on `alerts` and `transfers` — dashboard updates without page refresh

---

*Last updated: 2025 — Integrated Food & Beverage Operations Hub — Confidential*
