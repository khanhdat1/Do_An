import type { AiBuildSuggestion, BuildCheckResult, BuildComponentList, BuildSlot, SavedBuild, SavedBuildSummary } from "@/types";
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

export function suggestBuild(prompt: string, signal?: AbortSignal): Promise<AiBuildSuggestion> {
  return apiFetch<AiBuildSuggestion>("/api/ai/build", { method: "POST", body: { prompt }, signal });
}

/** Gọi từ trình duyệt (kèm cookie) để biết cấu hình mở từ link có thuộc tài khoản đang đăng nhập không */
export function fetchSavedBuild(code: string, signal?: AbortSignal): Promise<SavedBuild> {
  return apiFetch<SavedBuild>(`/api/pc-build/builds/${encodeURIComponent(code)}`, { signal });
}

export function saveBuild(name: string, selection: BuildSelection): Promise<SavedBuild> {
  return apiFetch<SavedBuild>("/api/pc-build/builds", { method: "POST", body: { name, items: selectionToItems(selection) } });
}

export async function listMyBuilds(): Promise<SavedBuildSummary[]> {
  return (await apiFetch<{ items: SavedBuildSummary[] }>("/api/pc-build/builds")).items;
}

export function deleteBuild(code: string): Promise<void> {
  return apiFetch<void>(`/api/pc-build/builds/${encodeURIComponent(code)}`, { method: "DELETE" });
}
