import type { SpecRow } from "@/types";

/** Bảng thông số kỹ thuật: nhãn bên trái, giá trị bên phải, dòng chẵn tô nền nhạt */
export default function SpecTable({ rows }: { rows: SpecRow[] }) {
  return (
    <dl className="overflow-hidden rounded-lg border border-slate-200 text-sm">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2.5 even:bg-slate-50"
        >
          <dt className="font-medium text-slate-500">{row.label}</dt>
          <dd className="text-slate-800">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
