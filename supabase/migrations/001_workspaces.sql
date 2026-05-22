-- ============================================================
-- SmartDoc Scanner — Combined Migration
-- Tables: documents, workspaces, workspace_members,
--         document_approvals
--
-- Structure:
--   PASS 1 — Extensions
--   PASS 2 — Create all tables (avoids forward-reference errors)
--   PASS 3 — Triggers & helper functions
--   PASS 4 — Enable RLS + all policies
--   PASS 5 — Semantic search functions
--   PASS 6 — Grants
--   PASS 7 — Reload schema cache
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PASS 1 — EXTENSIONS
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;


-- ════════════════════════════════════════════════════════════
-- PASS 2 — CREATE ALL TABLES
-- ════════════════════════════════════════════════════════════

-- 0. documents (base table)
CREATE TABLE IF NOT EXISTS public.documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          bigint      NOT NULL,
  created_at_iso      timestamptz DEFAULT now(),
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
  category            text        DEFAULT 'other',
  nlp_label           text,
  category_confidence numeric     DEFAULT 0,
  ocr_confidence      float,
  synced              boolean     DEFAULT true
);

-- Vector embedding & tags columns (added via ALTER to support existing installs)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS embedding    vector(384),
  ADD COLUMN IF NOT EXISTS tags         text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS workspace_id uuid   REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_docs_user_id    ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_workspace_id ON public.documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_docs_embedding
  ON public.documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_docs_tags
  ON public.documents
  USING gin (tags);


-- 1. workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        UNIQUE NOT NULL,
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings   jsonb       DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);


-- 2. workspace_members  (depends on workspaces)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  role         text        NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by   uuid        REFERENCES auth.users(id),
  joined_at    timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user_id      ON public.workspace_members(user_id);


-- 3. document_approvals  (depends on workspaces + documents)
CREATE TABLE IF NOT EXISTS public.document_approvals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id)  ON DELETE CASCADE,
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by uuid        NOT NULL REFERENCES auth.users(id),
  reviewed_by  uuid        REFERENCES auth.users(id),
  notes        text,
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_da_workspace_id ON public.document_approvals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_da_document_id  ON public.document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_da_status       ON public.document_approvals(workspace_id, status);


-- ════════════════════════════════════════════════════════════
-- PASS 3 — TRIGGERS & HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════

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


-- ── RLS Helper Functions (SECURITY DEFINER bypasses recursion) ──

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
  SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role = 'admin';
$$;


-- ════════════════════════════════════════════════════════════
-- PASS 4 — ENABLE RLS + ALL POLICIES
-- ════════════════════════════════════════════════════════════

-- ── RLS: documents ──────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own documents" ON public.documents;
DROP POLICY IF EXISTS "docs_select" ON public.documents;
DROP POLICY IF EXISTS "docs_insert" ON public.documents;
DROP POLICY IF EXISTS "docs_update" ON public.documents;
DROP POLICY IF EXISTS "docs_delete" ON public.documents;

CREATE POLICY "docs_select" ON public.documents
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_my_workspaces())
  );

CREATE POLICY "docs_insert" ON public.documents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "docs_update" ON public.documents
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "docs_delete" ON public.documents
  FOR DELETE USING (user_id = auth.uid());


-- ── RLS: workspaces ─────────────────────────────────────────
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspace_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspace_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspace_delete" ON public.workspaces;

CREATE POLICY "workspace_select" ON public.workspaces
  FOR SELECT USING (
    id IN (SELECT public.get_my_workspaces())
    OR owner_id = auth.uid()
  );

CREATE POLICY "workspace_insert" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspace_update" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "workspace_delete" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());


-- ── RLS: workspace_members ───────────────────────────────────
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wm_select" ON public.workspace_members;
DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "wm_update" ON public.workspace_members;
DROP POLICY IF EXISTS "wm_delete" ON public.workspace_members;

CREATE POLICY "wm_select" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT public.get_my_workspaces())
  );

CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT public.get_my_admin_workspaces())
  );

CREATE POLICY "wm_update" ON public.workspace_members
  FOR UPDATE USING (
    workspace_id IN (SELECT public.get_my_admin_workspaces())
  );

CREATE POLICY "wm_delete" ON public.workspace_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_my_admin_workspaces())
  );


-- ── RLS: document_approvals ──────────────────────────────────
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "da_select" ON public.document_approvals;
DROP POLICY IF EXISTS "da_insert" ON public.document_approvals;
DROP POLICY IF EXISTS "da_update" ON public.document_approvals;
DROP POLICY IF EXISTS "da_delete" ON public.document_approvals;

CREATE POLICY "da_select" ON public.document_approvals
  FOR SELECT USING (
    workspace_id IN (SELECT public.get_my_workspaces())
  );

CREATE POLICY "da_insert" ON public.document_approvals
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND workspace_id IN (SELECT public.get_my_workspaces())
  );

CREATE POLICY "da_update" ON public.document_approvals
  FOR UPDATE USING (
    workspace_id IN (SELECT public.get_my_admin_workspaces())
    OR (submitted_by = auth.uid() AND status = 'rejected')
  );

-- NOTE: File 1 had a da_delete policy; File 2 omitted it.
-- Keeping it so admins can remove approvals.
CREATE POLICY "da_delete" ON public.document_approvals
  FOR DELETE USING (
    workspace_id IN (SELECT public.get_my_admin_workspaces())
  );


-- ════════════════════════════════════════════════════════════
-- PASS 5 — SEMANTIC SEARCH FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- 5a. Full-text + vector semantic search
CREATE OR REPLACE FUNCTION search_documents_semantic(
  query_embedding   vector(384),
  p_user_id         uuid,
  match_threshold   float  DEFAULT 0.25,
  match_count       int    DEFAULT 8,
  filter_category   text   DEFAULT NULL,
  filter_date_from  bigint DEFAULT NULL,
  filter_date_to    bigint DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  supabase_id  uuid,
  vendor       text,
  total        text,
  date         text,
  category     text,
  created_at   bigint,
  image        text,
  cleaned_text text,
  tags         text[],
  similarity   float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.id                                  AS supabase_id,
    d.vendor,
    d.total,
    d.date,
    d.category,
    d.created_at,
    d.image,
    d.cleaned_text,
    d.tags,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.documents d
  WHERE
    d.user_id = p_user_id
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (filter_date_from IS NULL OR d.created_at >= filter_date_from)
    AND (filter_date_to   IS NULL OR d.created_at <= filter_date_to)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- 5b. Find documents similar to a given document
CREATE OR REPLACE FUNCTION find_similar_documents(
  p_document_id   uuid,
  p_user_id       uuid,
  match_threshold float DEFAULT 0.6,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (
  id         uuid,
  vendor     text,
  total      text,
  date       text,
  category   text,
  created_at bigint,
  similarity float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  source_embedding vector(384);
BEGIN
  SELECT embedding INTO source_embedding
  FROM public.documents
  WHERE id = p_document_id AND user_id = p_user_id;

  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.vendor,
    d.total,
    d.date,
    d.category,
    d.created_at,
    1 - (d.embedding <=> source_embedding) AS similarity
  FROM public.documents d
  WHERE
    d.user_id = p_user_id
    AND d.id <> p_document_id
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> source_embedding) > match_threshold
  ORDER BY d.embedding <=> source_embedding
  LIMIT match_count;
END;
$$;


-- 5c. Detect near-duplicate documents for a user
CREATE OR REPLACE FUNCTION find_duplicate_documents(
  p_user_id      uuid,
  dupe_threshold float DEFAULT 0.92
)
RETURNS TABLE (
  doc_a_id   uuid,
  doc_b_id   uuid,
  similarity float,
  vendor_a   text,
  vendor_b   text,
  date_a     text,
  date_b     text,
  total_a    text,
  total_b    text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id    AS doc_a_id,
    b.id    AS doc_b_id,
    1 - (a.embedding <=> b.embedding) AS similarity,
    a.vendor AS vendor_a,
    b.vendor AS vendor_b,
    a.date   AS date_a,
    b.date   AS date_b,
    a.total  AS total_a,
    b.total  AS total_b
  FROM public.documents a
  JOIN public.documents b
    ON  a.id < b.id
    AND a.user_id = p_user_id
    AND b.user_id = p_user_id
    AND 1 - (a.embedding <=> b.embedding) > dupe_threshold
  WHERE a.embedding IS NOT NULL
    AND b.embedding IS NOT NULL
  ORDER BY similarity DESC;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- PASS 6 — GRANTS FOR AUTHENTICATED ROLE
-- ════════════════════════════════════════════════════════════

GRANT USAGE  ON SCHEMA public TO authenticated;
GRANT ALL    ON public.documents          TO authenticated;
GRANT ALL    ON public.workspaces         TO authenticated;
GRANT ALL    ON public.workspace_members  TO authenticated;
GRANT ALL    ON public.document_approvals TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_workspaces()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION search_documents_semantic(
  vector(384), uuid, float, int, text, bigint, bigint)     TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_documents(
  uuid, uuid, float, int)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_documents(
  uuid, float)                                             TO authenticated;


-- ════════════════════════════════════════════════════════════
-- PASS 7 — RELOAD SCHEMA CACHE
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';