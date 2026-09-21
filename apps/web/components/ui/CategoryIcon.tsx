import {
  Box,
  CircuitBoard,
  Cpu,
  Gamepad2,
  HardDrive,
  Keyboard,
  Laptop,
  MemoryStick,
  Monitor,
  MonitorSmartphone,
  Mouse,
  Plug,
  Server,
  type LucideProps,
} from "lucide-react";

/** Map tên icon lưu trong DB (Category.icon) sang component lucide-react */
const categoryIcons = {
  Gamepad2,
  Laptop,
  Monitor,
  MonitorSmartphone,
  Server,
  Cpu,
  MemoryStick,
  CircuitBoard,
  HardDrive,
  Keyboard,
  Mouse,
  Plug,
  Box,
} as const;

interface CategoryIconProps extends LucideProps {
  /** Tên icon trong Category.icon; tên lạ rơi về icon CPU */
  name: string;
}

export default function CategoryIcon({ name, ...props }: CategoryIconProps) {
  const Icon = categoryIcons[name as keyof typeof categoryIcons] ?? Cpu;
  return <Icon {...props} />;
}
