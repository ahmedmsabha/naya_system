-- ============================================================
-- Naya System — Phase 2 Backfill (Legacy users -> AuthZ tables)
-- ============================================================
--
-- Purpose:
-- 1) Keep existing app behavior intact
-- 2) Populate new assignment tables from legacy users.role / users.branch_id
-- 3) Remain idempotent (safe to re-run)

-- Ensure baseline organization exists (created in phase 1 as well).
INSERT INTO organizations (slug, name)
VALUES ('default', 'Default Organization')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- Backfill user_role_assignments
-- ------------------------------------------------------------
WITH default_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'default'
  LIMIT 1
),
mapped_users AS (
  SELECT
    u.id AS user_id,
    u.branch_id,
    COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') AS legacy_role,
    CASE
      WHEN COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') = 'super_admin' THEN 'super_admin'
      WHEN COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') = 'warehouse_manager' THEN 'warehouse_manager'
      WHEN COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') = 'branch_staff' AND u.branch_id IS NOT NULL THEN 'branch_staff'
      WHEN COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') = 'branch_staff' AND u.branch_id IS NULL THEN 'viewer'
      ELSE 'viewer'
    END AS role_key,
    CASE
      WHEN COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') = 'super_admin' THEN 'organization'
      WHEN u.branch_id IS NOT NULL THEN 'branch'
      ELSE 'organization'
    END AS scope_type
  FROM users u
)
INSERT INTO user_role_assignments (
  user_id,
  organization_id,
  role_id,
  scope_type,
  branch_id,
  warehouse_id,
  assigned_by,
  created_at
)
SELECT
  mu.user_id,
  o.id AS organization_id,
  r.id AS role_id,
  mu.scope_type,
  CASE WHEN mu.scope_type = 'branch' THEN mu.branch_id ELSE NULL END AS branch_id,
  NULL AS warehouse_id,
  NULL AS assigned_by,
  now() AS created_at
FROM mapped_users mu
CROSS JOIN default_org o
JOIN roles r
  ON r.key = mu.role_key
 AND r.organization_id IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM user_role_assignments ura
  WHERE ura.user_id = mu.user_id
    AND ura.role_id = r.id
    AND (
      (mu.scope_type = 'organization' AND ura.scope_type = 'organization')
      OR
      (mu.scope_type = 'branch' AND ura.scope_type = 'branch' AND ura.branch_id = mu.branch_id)
    )
);

-- ------------------------------------------------------------
-- Backfill user_scope_assignments (branch scope from legacy branch_id)
-- ------------------------------------------------------------
WITH default_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'default'
  LIMIT 1
),
legacy_user_scope AS (
  SELECT
    u.id AS user_id,
    u.branch_id,
    COALESCE(NULLIF(TRIM(u.role), ''), 'branch_staff') AS legacy_role
  FROM users u
  WHERE u.branch_id IS NOT NULL
)
INSERT INTO user_scope_assignments (
  user_id,
  organization_id,
  scope_type,
  branch_id,
  warehouse_id,
  can_read,
  can_edit,
  assigned_by,
  created_at
)
SELECT
  lus.user_id,
  o.id AS organization_id,
  'branch' AS scope_type,
  lus.branch_id,
  NULL AS warehouse_id,
  true AS can_read,
  CASE
    WHEN lus.legacy_role = 'viewer' THEN false
    ELSE true
  END AS can_edit,
  NULL AS assigned_by,
  now() AS created_at
FROM legacy_user_scope lus
CROSS JOIN default_org o
WHERE NOT EXISTS (
  SELECT 1
  FROM user_scope_assignments usa
  WHERE usa.user_id = lus.user_id
    AND usa.scope_type = 'branch'
    AND usa.branch_id = lus.branch_id
);

-- ------------------------------------------------------------
-- Audit trail for migration bookkeeping
-- ------------------------------------------------------------
WITH default_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'default'
  LIMIT 1
)
INSERT INTO audit_log (
  organization_id,
  actor_user_id,
  target_user_id,
  event_type,
  entity_type,
  entity_id,
  payload,
  created_at
)
SELECT
  o.id AS organization_id,
  NULL AS actor_user_id,
  NULL AS target_user_id,
  'migration_backfill',
  'authz_assignments',
  NULL AS entity_id,
  jsonb_build_object(
    'migration', '20260416151001_backfill_users_to_authz_assignments',
    'note', 'Backfilled user role and scope assignments from legacy users columns'
  ) AS payload,
  now() AS created_at
FROM default_org o
WHERE NOT EXISTS (
  SELECT 1
  FROM audit_log al
  WHERE al.event_type = 'migration_backfill'
    AND al.entity_type = 'authz_assignments'
    AND al.payload ->> 'migration' = '20260416151001_backfill_users_to_authz_assignments'
);
