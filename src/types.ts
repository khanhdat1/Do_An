export type CategoryConfig = {
  name: string;
  slug: string;
  url: string;
  keywords: RegExp;
};

export type ScrapedProduct = {
  name: string;
  slug: string;
  sourceUrl: string;
  category: { name: string; slug: string };
  brand: string | null;
  price: number | null;
  originalPrice: number | null;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN";
  warrantyMonths: number | null;
  shortSpecs: string[];
  specifications: Record<string, string>;
  description: string | null;
  images: { url: string; alt?: string }[];
};
