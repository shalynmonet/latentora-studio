ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS owner_id uuid;
CREATE INDEX IF NOT EXISTS workspaces_owner_id_idx ON public.workspaces(owner_id);