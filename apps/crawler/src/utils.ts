import slugify from "slugify";

export function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function toSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, locale: "vi" });
}

export function parseVnd(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]{4,})\s*(?:đ|₫)/i);
  if (!match) return null;
  const n = Number(match[1].replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function absoluteUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
