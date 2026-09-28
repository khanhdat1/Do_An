import type { Metadata } from "next";
import BuildPcView from "@/components/build-pc/BuildPcView";
import { getSavedBuild } from "@/lib/api";
import { selectionFromParams, selectionFromSaved } from "@/lib/pc-build";

export const metadata: Metadata = {
  title: "Build PC | PCZone",
  description: "Tự chọn linh kiện hoặc nhờ AI gợi ý cả bộ theo ngân sách, kiểm tra tương thích tự động, tính tổng tiền và công suất nguồn.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuildPcPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = typeof params.build === "string" ? params.build : undefined;
  const savedBuild = code ? await getSavedBuild(code) : null;

  return (
    <BuildPcView
      initialSelection={savedBuild ? selectionFromSaved(savedBuild) : selectionFromParams(params)}
      savedBuild={savedBuild}
      missingBuildCode={code && !savedBuild ? code : undefined}
    />
  );
}
