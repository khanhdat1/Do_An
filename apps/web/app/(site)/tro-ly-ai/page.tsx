import type { Metadata } from "next";
import AiChatView from "@/components/ai-chat/AiChatView";

export const metadata: Metadata = {
  title: "Trợ lý AI | PCZone",
  description: "Trò chuyện với trợ lý AI PCZone để được tư vấn sản phẩm dựa trên kho hàng thật.",
  // Nội dung hội thoại là riêng tư theo từng khách, không có giá trị lập chỉ mục
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AiChatPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const initialQuestion = typeof raw.q === "string" && raw.q.trim() ? raw.q : undefined;

  return <AiChatView initialQuestion={initialQuestion} />;
}
