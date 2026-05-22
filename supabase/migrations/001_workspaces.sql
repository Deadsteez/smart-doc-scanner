-- ============================================================
-- SmartDoc Scanner — Part A Migration
-- Tables: workspaces, workspace_members, document_approvals
--
-- NOTE: All 3 tables are created FIRST (Pass 1), then all RLS
-- policies are applied SECOND (Pass 2). This avoids the
-- "relation does not exist" error caused by forward references
-- in RLS policies that cross-reference other tables.
-- ============================================================

-- Enable pgcrypto for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ════════════════════════════════════════════════════════════
-- PASS 1 — CREATE ALL TABLES
-- ════════════════════════════════════════════════════════════

-- 0. documents (from the base app)
CREATE TABLE IF NOT EXISTS public.documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          bigint NOT NULL,
  image               text,
  ocr_text            text,
  cleaned_text        text,
  vendor              text,
  date                text,
  total               text,
  receipt_number      text,
  tax                 text,
  payment_method      text,
  items               jsonb,
  category            text,
  nlp_label           text,
  category_confidence numeric,
  synced              boolean
);

CREATE INDEX IF NOT EXISTS idx_docs_user_id ON public.documents(user_id);


-- 1. workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);


-- 2. workspace_members  (depends on workspaces)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by    uuid REFERENCES auth.users(id),
  joined_at     timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user_id      ON public.workspace_members(user_id);


-- 3. document_approvals  (depends on workspaces + documents)
CREATE TABLE IF NOT EXISTS public.document_approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by  uuid NOT NULL REFERENCES auth.users(id),
  reviewed_by   uuid REFERENCES auth.users(id),
  notes         text,
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_da_workspace_id ON public.document_approvals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_da_document_id  ON public.document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_da_status       ON public.document_approvals(workspace_id, status);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_da_updated_at ON public.document_approvals;
CREATE TRIGGER trg_da_updated_at
  BEFORE UPDATE ON public.document_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. Add workspace_id column to existing documents table (if migrating from older version)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_docs_workspace_id ON public.documents(workspace_id);


-- ════════════════════════════════════════════════════════════
-- PASS 2 — ENABLE RLS + ALL POLICIES
-- ════════════════════════════════════════════════════════════

-- ── Helper Functions for RLS (Bypasses Recursion) ───────────
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  UNION
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_workspaces()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  UNION
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin';
$$;


-- ── RLS: documents ──────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select" ON public.documents;
CREATE POLICY "docs_select" ON public.documents
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT * FROM public.get_my_workspaces())
  );

DROP POLICY IF EXISTS "docs_insert" ON public.documents;
CREATE POLICY "docs_insert" ON public.documents
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "docs_update" ON public.documents;
CREATE POLICY "docs_update" ON public.documents
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "docs_delete" ON public.documents;
CREATE POLICY "docs_delete" ON public.documents
  FOR DELETE USING (user_id = auth.uid());


-- ── RLS: workspaces ─────────────────────────────────────────
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select" ON public.workspaces;
CREATE POLICY "workspace_select" ON public.workspaces
  FOR SELECT USING (
    id IN (SELECT * FROM public.get_my_workspaces())
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "workspace_insert" ON public.workspaces;
CREATE POLICY "workspace_insert" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspace_update" ON public.workspaces;
CREATE POLICY "workspace_update" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspace_delete" ON public.workspaces;
CREATE POLICY "workspace_delete" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());


-- ── RLS: workspace_members ───────────────────────────────────
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wm_select" ON public.workspace_members;
CREATE POLICY "wm_select" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT * FROM public.get_my_workspaces())
  );

DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT * FROM public.get_my_admin_workspaces())
  );

DROP POLICY IF EXISTS "wm_update" ON public.workspace_members;
CREATE POLICY "wm_update" ON public.workspace_members
  FOR UPDATE USING (
    workspace_id IN (SELECT * FROM public.get_my_admin_workspaces())
  );

DROP POLICY IF EXISTS "wm_delete" ON public.workspace_members;
CREATE POLICY "wm_delete" ON public.workspace_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT * FROM public.get_my_admin_workspaces())
  );


-- ── RLS: document_approvals ──────────────────────────────────
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "da_select" ON public.document_approvals;
CREATE POLICY "da_select" ON public.document_approvals
  FOR SELECT USING (
    workspace_id IN (SELECT * FROM public.get_my_workspaces())
  );

DROP POLICY IF EXISTS "da_insert" ON public.document_approvals;
CREATE POLICY "da_insert" ON public.document_approvals
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND workspace_id IN (SELECT * FROM public.get_my_workspaces())
  );

DROP POLICY IF EXISTS "da_update" ON public.document_approvals;
CREATE POLICY "da_update" ON public.document_approvals
  FOR UPDATE USING (
    workspace_id IN (SELECT * FROM public.get_my_admin_workspaces())
    OR (submitted_by = auth.uid() AND status = 'rejected')
  );

DROP POLICY IF EXISTS "da_delete" ON public.document_approvals;
CREATE POLICY "da_delete" ON public.document_approvals
  FOR DELETE USING (
    workspace_id IN (SELECT * FROM public.get_my_admin_workspaces())
  );


-- ════════════════════════════════════════════════════════════
-- PASS 3 — EXPLICIT GRANTS FOR AUTHENTICATED ROLE
-- ════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.workspaces TO authenticated;
GRANT ALL ON public.workspace_members TO authenticated;
GRANT ALL ON public.document_approvals TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.get_my_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_workspaces() TO authenticated;


-- ════════════════════════════════════════════════════════════
-- PASS 4 — RELOAD SCHEMA CACHE
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
