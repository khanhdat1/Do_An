import type { BuildCheckResult, BuildComponentList, BuildSlot } from "@/types";
import { apiFetch } from "./api-client";
import { selectionToItems, selectionToSearch, slotParam, type BuildSelection } from "./pc-build";

export function validateBuild(selection: BuildSelection, signal?: AbortSignal): Promise<BuildCheckResult> {
  return apiFetch<BuildCheckResult>("/api/pc-build/validate", {
    method: "POST",
    body: { items: selectionToItems(selection) },
    signal,
  });
}

export function fetchBuildComponents(slot: BuildSlot, selection: BuildSelection, signal?: AbortSignal): Promise<BuildComponentList> {
  const search = selectionToSearch(selection);
  return apiFetch<BuildComponentList>(`/api/pc-build/components?type=${slotParam(slot)}${search ? `&${search}` : ""}`, { signal });
}
