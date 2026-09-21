/**
 * Đọc dữ liệu có cấu trúc mà trang GEARVN nhúng sẵn trong HTML.
 *
 * GEARVN dựng bằng Next.js, nên mỗi trang mang theo dữ liệu gốc dưới dạng JSON thay vì chỉ có
 * HTML hiển thị. Đọc JSON này ổn định hơn nhiều so với bóc theo class CSS (class Tailwind dài,
 * đổi theo mỗi lần triển khai):
 *
 *   - trang bộ sưu tập: danh sách sản phẩm (tên, slug, ảnh, giá, còn hàng, hãng, thông số nổi bật)
 *   - trang sản phẩm: JSON-LD `Product` (giá, ảnh, hãng) + bảng thuộc tính đầy đủ (nhãn / giá trị)
 *
 * Toàn bộ hàm trong file này là hàm thuần (không gọi mạng) nên kiểm thử được bằng chuỗi mẫu.
 */

/** Ghép các đoạn `self.__next_f.push([1,"..."])` thành một chuỗi duy nhất, đã bỏ escape */
export function readRscText(html: string): string {
  const chunks: string[] = [];

  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`) as string);
    } catch {
      // đoạn hỏng thì bỏ qua, không làm chết cả trang
    }
  }

  return chunks.join("");
}

/**
 * Đọc một đối tượng JSON bắt đầu đúng tại `start` (ký tự `{`). Đếm ngoặc có tính tới chuỗi và
 * dấu escape, vì giá trị chữ có thể chứa `{` hoặc `}`.
 */
function readJsonObject(text: string, start: number): { value: unknown; end: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return { value: JSON.parse(text.slice(start, i + 1)), end: i + 1 };
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/** Mọi đối tượng JSON mở đầu bằng `marker` (vd `{"label":"`), theo thứ tự xuất hiện; không lồng nhau */
export function findObjects(text: string, marker: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const at = text.indexOf(marker, from);
    if (at === -1) break;

    const parsed = readJsonObject(text, at);
    if (parsed && typeof parsed.value === "object" && parsed.value !== null) {
      found.push(parsed.value as Record<string, unknown>);
      from = parsed.end;
    } else {
      from = at + marker.length;
    }
  }

  return found;
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const asNumber = (value: unknown): number | null => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
};

/* -------------------------------------------------------------------------- */
/*  Trang bộ sưu tập                                                          */
/* -------------------------------------------------------------------------- */

export interface ListingProduct {
  name: string;
  /** Cũng là đường dẫn trang sản phẩm: https://gearvn.com/products/<slug> */
  slug: string;
  imageUrl: string | null;
  price: number;
  /** Giá niêm yết khi đang giảm giá */
  originalPrice: number | null;
  inStock: boolean;
  brand: string | null;
  /** Vài thông số nổi bật dạng chữ ngắn: "24 inch", "IPS", "144 Hz" */
  highlights: string[];
}

export function parseCollectionPage(html: string): ListingProduct[] {
  const products: ListingProduct[] = [];
  const seen = new Set<string>();

  for (const object of findObjects(readRscText(html), '{"id":"')) {
    const name = asString(object.name);
    const slug = asString(object.slug);
    const price = asNumber(object.price);
    // Chỉ nhận đối tượng có đủ dạng của một sản phẩm (RSC còn chứa nhiều đối tượng `id` khác)
    if (!name || !slug || price === null || !("imageUrl" in object) || seen.has(slug)) continue;
    seen.add(slug);

    const highlights = Array.isArray(object.specHighlights)
      ? object.specHighlights
          .map((item) => asString((item as { value?: unknown } | null)?.value))
          .filter((value): value is string => value !== null)
      : [];

    products.push({
      name,
      slug,
      imageUrl: asString(object.imageUrl),
      price,
      originalPrice: asNumber(object.originalPrice),
      inStock: object.inStock === true,
      brand: asString(object.brand),
      highlights,
    });
  }

  return products;
}

/* -------------------------------------------------------------------------- */
/*  Trang sản phẩm                                                            */
/* -------------------------------------------------------------------------- */

export interface ProductAttribute {
  label: string;
  value: string;
  /** GEARVN đánh dấu thông số quan trọng nhất của sản phẩm */
  highlight: boolean;
}

export interface ProductPage {
  name: string | null;
  brand: string | null;
  sku: string | null;
  price: number | null;
  listPrice: number | null;
  inStock: boolean;
  images: string[];
  attributes: ProductAttribute[];
}

/** Khối JSON-LD có `@type: Product` (nếu có) */
function readJsonLdProduct(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(match[1]);
      const list = Array.isArray(data) ? data : [data];
      const product = list.find(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && (item as { "@type"?: unknown })["@type"] === "Product",
      );
      if (product) return product;
    } catch {
      // khối JSON-LD hỏng thì thử khối kế tiếp
    }
  }
  return null;
}

/** Gọn khoảng trắng; bỏ giá trị rỗng hoặc dài bất thường (đoạn văn quảng cáo lọt vào bảng thông số) */
function cleanValue(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  return text !== "" && text.length <= 240 ? text : null;
}

export function parseProductPage(html: string): ProductPage {
  const product = readJsonLdProduct(html);
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const offer = (typeof offers === "object" && offers !== null ? offers : {}) as Record<string, unknown>;
  const spec = (typeof offer.priceSpecification === "object" && offer.priceSpecification !== null
    ? offer.priceSpecification
    : {}) as Record<string, unknown>;

  const brand = product?.brand;
  const images = Array.isArray(product?.image)
    ? product.image
    : typeof product?.image === "string"
      ? [product.image]
      : [];

  // Bảng thông số đầy đủ nằm trong dữ liệu Next.js; giữ đúng thứ tự, bỏ nhãn trùng
  const attributes: ProductAttribute[] = [];
  const labels = new Set<string>();
  for (const object of findObjects(readRscText(html), '{"label":"')) {
    const label = asString(object.label);
    const value = typeof object.value === "string" ? cleanValue(object.value) : null;
    if (!label || !value || !("group_name" in object) || labels.has(label)) continue;
    labels.add(label);
    attributes.push({ label, value, highlight: object.is_highlight === true });
  }

  return {
    name: asString(product?.name),
    brand: asString(typeof brand === "object" && brand !== null ? (brand as { name?: unknown }).name : brand),
    sku: asString(product?.sku),
    price: asNumber(offer.price),
    // `priceSpecification.price` là giá niêm yết (giá trước giảm)
    listPrice: asNumber(spec.price),
    inStock: typeof offer.availability === "string" && /InStock/i.test(offer.availability),
    images: images.filter((url): url is string => typeof url === "string" && url.startsWith("https://")),
    attributes,
  };
}
