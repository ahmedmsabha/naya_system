-- ============================================================
-- Naya System — Phase 1 Multi-Tenant AuthZ Foundation
-- ============================================================

-- Private schema for authorization helper functions.
CREATE SCHEMA IF NOT EXISTS private;

-- ------------------------------------------------------------
-- Core tenant and authorization tables
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read', 'edit')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'branch', 'warehouse')),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_role_assignments_scope_ck CHECK (
    (scope_type = 'organization' AND branch_id IS NULL AND warehouse_id IS NULL) OR
    (scope_type = 'branch' AND branch_id IS NOT NULL AND warehouse_id IS NULL) OR
    (scope_type = 'warehouse' AND warehouse_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS user_scope_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('branch', 'warehouse')),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_scope_assignments_scope_ck CHECK (
    (scope_type = 'branch' AND branch_id IS NOT NULL AND warehouse_id IS NULL) OR
    (scope_type = 'warehouse' AND warehouse_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'branch', 'warehouse')),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_overrides_scope_ck CHECK (
    (scope_type = 'organization' AND branch_id IS NULL AND warehouse_id IS NULL) OR
    (scope_type = 'branch' AND branch_id IS NOT NULL AND warehouse_id IS NULL) OR
    (scope_type = 'warehouse' AND warehouse_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Indexes and uniqueness
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS warehouses_org_code_uidx
  ON warehouses (organization_id, code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_system_key_uidx
  ON roles (key)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_org_key_uidx
  ON roles (organization_id, key)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_role_assignments_user_org_idx
  ON user_role_assignments (user_id, organization_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_org_scope_idx
  ON user_role_assignments (organization_id, scope_type);
CREATE INDEX IF NOT EXISTS user_role_assignments_role_idx
  ON user_role_assignments (role_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_branch_idx
  ON user_role_assignments (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_role_assignments_warehouse_idx
  ON user_role_assignments (warehouse_id) WHERE warehouse_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_org_unique
  ON user_role_assignments (user_id, role_id)
  WHERE scope_type = 'organization';
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_branch_unique
  ON user_role_assignments (user_id, role_id, branch_id)
  WHERE scope_type = 'branch';
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_warehouse_unique
  ON user_role_assignments (user_id, role_id, warehouse_id)
  WHERE scope_type = 'warehouse';

CREATE INDEX IF NOT EXISTS user_scope_assignments_user_org_idx
  ON user_scope_assignments (user_id, organization_id);
CREATE INDEX IF NOT EXISTS user_scope_assignments_org_scope_idx
  ON user_scope_assignments (organization_id, scope_type);
CREATE INDEX IF NOT EXISTS user_scope_assignments_branch_idx
  ON user_scope_assignments (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_scope_assignments_warehouse_idx
  ON user_scope_assignments (warehouse_id) WHERE warehouse_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_scope_assignments_branch_unique
  ON user_scope_assignments (user_id, branch_id)
  WHERE scope_type = 'branch';
CREATE UNIQUE INDEX IF NOT EXISTS user_scope_assignments_warehouse_unique
  ON user_scope_assignments (user_id, warehouse_id)
  WHERE scope_type = 'warehouse';

CREATE INDEX IF NOT EXISTS user_permission_overrides_user_org_idx
  ON user_permission_overrides (user_id, organization_id);
CREATE INDEX IF NOT EXISTS user_permission_overrides_permission_idx
  ON user_permission_overrides (permission_id);
CREATE INDEX IF NOT EXISTS user_permission_overrides_scope_idx
  ON user_permission_overrides (organization_id, scope_type);

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_org_unique
  ON user_permission_overrides (user_id, permission_id)
  WHERE scope_type = 'organization';
CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_branch_unique
  ON user_permission_overrides (user_id, permission_id, branch_id)
  WHERE scope_type = 'branch';
CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_warehouse_unique
  ON user_permission_overrides (user_id, permission_id, warehouse_id)
  WHERE scope_type = 'warehouse';

CREATE INDEX IF NOT EXISTS audit_log_org_created_idx
  ON audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_created_idx
  ON audit_log (target_user_id, created_at DESC);

-- ------------------------------------------------------------
-- Authorization helper functions (private schema)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_super_admin(p_org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = auth.uid()
      AND r.key = 'super_admin'
      AND (p_org_id IS NULL OR ura.organization_id = p_org_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.has_org_access(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    private.is_super_admin(p_org_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.organization_id = p_org_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_scope_assignments usa
      WHERE usa.user_id = auth.uid()
        AND usa.organization_id = p_org_id
    );
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_org_access(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Seed baseline organization, roles, permissions
-- ------------------------------------------------------------

INSERT INTO organizations (slug, name)
VALUES ('default', 'Default Organization')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO permissions (key, resource, action, description)
VALUES
  ('dashboard.read', 'dashboard', 'read', 'View dashboard data'),
  ('dashboard.edit', 'dashboard', 'edit', 'Edit dashboard settings'),
  ('warehouse.read', 'warehouse', 'read', 'View warehouse module'),
  ('warehouse.edit', 'warehouse', 'edit', 'Edit warehouse module'),
  ('vendors.read', 'vendors', 'read', 'View vendor data'),
  ('vendors.edit', 'vendors', 'edit', 'Edit vendor data'),
  ('financials.read', 'financials', 'read', 'View financial reports'),
  ('financials.edit', 'financials', 'edit', 'Edit financial settings and entries'),
  ('staffing.read', 'staffing', 'read', 'View staffing records'),
  ('staffing.edit', 'staffing', 'edit', 'Edit staffing records'),
  ('payroll.read', 'payroll', 'read', 'View payroll data'),
  ('payroll.edit', 'payroll', 'edit', 'Edit payroll data'),
  ('alerts.read', 'alerts', 'read', 'View alert center'),
  ('alerts.edit', 'alerts', 'edit', 'Manage alerts'),
  ('settings.read', 'settings', 'read', 'View settings and access pages'),
  ('settings.edit', 'settings', 'edit', 'Edit system settings and access rules')
ON CONFLICT (key) DO NOTHING;

INSERT INTO roles (organization_id, key, label, description, is_system)
VALUES
  (NULL, 'super_admin', 'Super Admin', 'Full access across all modules and scopes', true),
  (NULL, 'branch_manager', 'Branch Manager', 'Manages branch operations and reporting', true),
  (NULL, 'warehouse_manager', 'Warehouse Manager', 'Manages warehouse operations', true),
  (NULL, 'branch_staff', 'Branch Staff', 'Daily branch operations', true),
  (NULL, 'viewer', 'Viewer', 'Read-only access for assigned scopes', true)
ON CONFLICT DO NOTHING;

-- Super admin => all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;

-- Branch manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'dashboard.read',
  'warehouse.read', 'warehouse.edit',
  'vendors.read', 'vendors.edit',
  'financials.read', 'financials.edit',
  'staffing.read', 'staffing.edit',
  'payroll.read', 'payroll.edit',
  'alerts.read',
  'settings.read'
)
WHERE r.key = 'branch_manager'
ON CONFLICT DO NOTHING;

-- Warehouse manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'dashboard.read',
  'warehouse.read', 'warehouse.edit',
  'vendors.read', 'vendors.edit',
  'alerts.read'
)
WHERE r.key = 'warehouse_manager'
ON CONFLICT DO NOTHING;

-- Branch staff permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'dashboard.read',
  'warehouse.read', 'warehouse.edit',
  'vendors.read',
  'staffing.read',
  'alerts.read'
)
WHERE r.key = 'branch_staff'
ON CONFLICT DO NOTHING;

-- Viewer permissions (all read-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.action = 'read'
WHERE r.key = 'viewer'
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- RLS setup
-- ------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scope_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- organizations
DROP POLICY IF EXISTS organizations_select ON organizations;
CREATE POLICY organizations_select
ON organizations
FOR SELECT
TO authenticated
USING (private.has_org_access(id));

DROP POLICY IF EXISTS organizations_manage ON organizations;
CREATE POLICY organizations_manage
ON organizations
FOR ALL
TO authenticated
USING (private.is_super_admin(id))
WITH CHECK (private.is_super_admin(id));

-- warehouses
DROP POLICY IF EXISTS warehouses_select ON warehouses;
CREATE POLICY warehouses_select
ON warehouses
FOR SELECT
TO authenticated
USING (private.has_org_access(organization_id));

DROP POLICY IF EXISTS warehouses_manage ON warehouses;
CREATE POLICY warehouses_manage
ON warehouses
FOR ALL
TO authenticated
USING (private.is_super_admin(organization_id))
WITH CHECK (private.is_super_admin(organization_id));

-- roles
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select
ON roles
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR private.has_org_access(organization_id)
);

DROP POLICY IF EXISTS roles_manage ON roles;
CREATE POLICY roles_manage
ON roles
FOR ALL
TO authenticated
USING (
  (organization_id IS NULL AND private.is_super_admin(NULL))
  OR (organization_id IS NOT NULL AND private.is_super_admin(organization_id))
)
WITH CHECK (
  (organization_id IS NULL AND private.is_super_admin(NULL))
  OR (organization_id IS NOT NULL AND private.is_super_admin(organization_id))
);

-- permissions
DROP POLICY IF EXISTS permissions_select ON permissions;
CREATE POLICY permissions_select
ON permissions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS permissions_manage ON permissions;
CREATE POLICY permissions_manage
ON permissions
FOR ALL
TO authenticated
USING (private.is_super_admin(NULL))
WITH CHECK (private.is_super_admin(NULL));

-- role_permissions
DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select
ON role_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM roles r
    WHERE r.id = role_permissions.role_id
      AND (r.organization_id IS NULL OR private.has_org_access(r.organization_id))
  )
);

DROP POLICY IF EXISTS role_permissions_manage ON role_permissions;
CREATE POLICY role_permissions_manage
ON role_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM roles r
    WHERE r.id = role_permissions.role_id
      AND (
        (r.organization_id IS NULL AND private.is_super_admin(NULL))
        OR (r.organization_id IS NOT NULL AND private.is_super_admin(r.organization_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM roles r
    WHERE r.id = role_permissions.role_id
      AND (
        (r.organization_id IS NULL AND private.is_super_admin(NULL))
        OR (r.organization_id IS NOT NULL AND private.is_super_admin(r.organization_id))
      )
  )
);

-- user_role_assignments
DROP POLICY IF EXISTS user_role_assignments_select ON user_role_assignments;
CREATE POLICY user_role_assignments_select
ON user_role_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_org_access(organization_id)
);

DROP POLICY IF EXISTS user_role_assignments_insert ON user_role_assignments;
CREATE POLICY user_role_assignments_insert
ON user_role_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_super_admin(organization_id)
  OR NOT EXISTS (SELECT 1 FROM user_role_assignments)
);

DROP POLICY IF EXISTS user_role_assignments_update ON user_role_assignments;
CREATE POLICY user_role_assignments_update
ON user_role_assignments
FOR UPDATE
TO authenticated
USING (private.is_super_admin(organization_id))
WITH CHECK (private.is_super_admin(organization_id));

DROP POLICY IF EXISTS user_role_assignments_delete ON user_role_assignments;
CREATE POLICY user_role_assignments_delete
ON user_role_assignments
FOR DELETE
TO authenticated
USING (private.is_super_admin(organization_id));

-- user_scope_assignments
DROP POLICY IF EXISTS user_scope_assignments_select ON user_scope_assignments;
CREATE POLICY user_scope_assignments_select
ON user_scope_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_org_access(organization_id)
);

DROP POLICY IF EXISTS user_scope_assignments_insert ON user_scope_assignments;
CREATE POLICY user_scope_assignments_insert
ON user_scope_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_super_admin(organization_id)
  OR NOT EXISTS (SELECT 1 FROM user_scope_assignments)
);

DROP POLICY IF EXISTS user_scope_assignments_update ON user_scope_assignments;
CREATE POLICY user_scope_assignments_update
ON user_scope_assignments
FOR UPDATE
TO authenticated
USING (private.is_super_admin(organization_id))
WITH CHECK (private.is_super_admin(organization_id));

DROP POLICY IF EXISTS user_scope_assignments_delete ON user_scope_assignments;
CREATE POLICY user_scope_assignments_delete
ON user_scope_assignments
FOR DELETE
TO authenticated
USING (private.is_super_admin(organization_id));

-- user_permission_overrides
DROP POLICY IF EXISTS user_permission_overrides_select ON user_permission_overrides;
CREATE POLICY user_permission_overrides_select
ON user_permission_overrides
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_org_access(organization_id)
);

DROP POLICY IF EXISTS user_permission_overrides_insert ON user_permission_overrides;
CREATE POLICY user_permission_overrides_insert
ON user_permission_overrides
FOR INSERT
TO authenticated
WITH CHECK (private.is_super_admin(organization_id));

DROP POLICY IF EXISTS user_permission_overrides_update ON user_permission_overrides;
CREATE POLICY user_permission_overrides_update
ON user_permission_overrides
FOR UPDATE
TO authenticated
USING (private.is_super_admin(organization_id))
WITH CHECK (private.is_super_admin(organization_id));

DROP POLICY IF EXISTS user_permission_overrides_delete ON user_permission_overrides;
CREATE POLICY user_permission_overrides_delete
ON user_permission_overrides
FOR DELETE
TO authenticated
USING (private.is_super_admin(organization_id));

-- audit_log
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select
ON audit_log
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR private.has_org_access(organization_id)
);

DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NULL
  OR private.has_org_access(organization_id)
);

DROP POLICY IF EXISTS audit_log_manage ON audit_log;
CREATE POLICY audit_log_manage
ON audit_log
FOR UPDATE
TO authenticated
USING (private.is_super_admin(organization_id))
WITH CHECK (private.is_super_admin(organization_id));
