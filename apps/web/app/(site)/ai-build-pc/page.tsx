import type { Metadata } from "next";
import BuildPcView from "@/components/build-pc/BuildPcView";
import { selectionFromParams } from "@/lib/pc-build";

export const metadata: Metadata = {
  title: "Build PC | PCZone",
  description: "Tự chọn linh kiện đang bán tại PCZone, kiểm tra tương thích tự động, tính tổng tiền và công suất nguồn cần thiết.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuildPcPage({ searchParams }: PageProps) {
  return <BuildPcView initialSelection={selectionFromParams(await searchParams)} />;
}
