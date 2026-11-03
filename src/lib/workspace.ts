// Client-side workspace handling: the workspace id lives in localStorage.
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { createWorkspace, getApiStatus, getWorkspace } from "./latentora.functions";

const STORAGE_KEY = "latentora.workspace";

export const statusQuery = queryOptions({
  queryKey: ["api-status"],
  queryFn: () => getApiStatus(),
  staleTime: 5 * 60_000,
});

export const workspaceQuery = (id: string | null) =>
  queryOptions({
    queryKey: ["workspace", id],
    queryFn: () => (id ? getWorkspace({ data: { id } }) : Promise.resolve(null)),
    enabled: Boolean(id),
  });

const listeners = new Set<(id: string | null) => void>();

export function setWorkspaceId(id: string | null) {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l(id));
}

export function useWorkspaceId() {
  const [id, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setId(localStorage.getItem(STORAGE_KEY));
    setReady(true);
    listeners.add(setId);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  return { id, ready };
}

export function useWorkspace() {
  const { id, ready } = useWorkspaceId();
  const q = useQuery(workspaceQuery(id));
  const qc = useQueryClient();
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["workspace", id] }), [qc, id]);
  // Stale id (workspace deleted) → forget it.
  useEffect(() => {
    if (id && q.isSuccess && q.data === null) setWorkspaceId(null);
  }, [id, q.isSuccess, q.data]);
  return { id, ready, data: q.data ?? null, isLoading: !ready || (Boolean(id) && q.isLoading), error: q.error, refresh };
}

export async function startWorkspace(demo: boolean) {
  const { id } = await createWorkspace({ data: { demo } });
  setWorkspaceId(id);
  return id;
}
