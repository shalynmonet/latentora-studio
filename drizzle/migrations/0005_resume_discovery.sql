CREATE TABLE public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_kind text NOT NULL CHECK (file_kind IN ('pdf','docx')),
  source text NOT NULL,
  model text,
  quotes_checked boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL,
  review jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resumes_workspace_idx ON public.resumes(workspace_id, created_at DESC);
GRANT ALL ON public.resumes TO service_role;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.resumes IS 'Résumé analysis (quoted passages + findings + user review). Raw documents and full text are never stored.';