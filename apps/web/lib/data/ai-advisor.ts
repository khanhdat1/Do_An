import type { LucideIcon } from "lucide-react";
import { Flame, GraduationCap, Laptop, Wallet } from "lucide-react";

/** Câu hỏi gợi ý cho trợ lý AI — dùng chung ở khối trang chủ và màn hình trống của trang chat */
export const aiAdvisorSuggestions: { icon: LucideIcon; label: string }[] = [
  { icon: Flame, label: "Laptop gaming dưới 20 triệu" },
  { icon: GraduationCap, label: "Laptop cho sinh viên IT & Data Science" },
  { icon: Laptop, label: "PC 30tr chơi mượt Black Myth: Wukong" },
  { icon: Wallet, label: "Build PC theo ngân sách linh hoạt" },
];
