-- ============================================================
-- Naya System — Foundation Schema
-- ============================================================

-- Branches (includes commissary as type = 'commissary')
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'branch', -- 'branch' | 'commissary'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'super_admin' | 'warehouse_manager' | 'branch_staff'
  branch_id UUID REFERENCES branches(id),
  language TEXT DEFAULT 'en', -- 'en' | 'ar' | 'tr' | 'fr'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingredients (raw materials)
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL, -- 'kg' | 'g' | 'L' | 'ml' | 'piece'
  cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu items / recipes
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe ingredient breakdown
CREATE TABLE IF NOT EXISTS recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity_grams NUMERIC(10,4) NOT NULL -- always in base unit
);

-- Inventory per branch (snapshot after each count)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity_on_hand NUMERIC(10,3) NOT NULL DEFAULT 0,
  counted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  counted_by UUID REFERENCES users(id)
);

-- Transfer orders (warehouse → branch)
CREATE TABLE IF NOT EXISTS transfers (
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
CREATE TABLE IF NOT EXISTS transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity_sent NUMERIC(10,3) NOT NULL,
  quantity_received NUMERIC(10,3), -- filled on confirmation
  markup_pct NUMERIC(5,2) DEFAULT 0, -- inter-branch pricing
  unit_cost NUMERIC(10,4) NOT NULL -- cost at time of transfer
);

-- Sales records (synced from POS or entered manually)
CREATE TABLE IF NOT EXISTS sales (
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
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase orders (commissary ← supplier)
CREATE TABLE IF NOT EXISTS purchase_orders (
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
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(10,3) NOT NULL,
  unit_cost NUMERIC(10,4) NOT NULL
);

-- Digital checklists (daily quality & operations)
CREATE TABLE IF NOT EXISTS checklists (
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
CREATE TABLE IF NOT EXISTS quality_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  food_score INTEGER CHECK (food_score BETWEEN 1 AND 5),
  service_score INTEGER CHECK (service_score BETWEEN 1 AND 5),
  cleanliness_score INTEGER CHECK (cleanliness_score BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- System alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id), -- NULL = global alert
  type TEXT NOT NULL, -- 'variance' | 'low_stock' | 'quality' | 'transfer_delay'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info' | 'warning' | 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT now()
);
