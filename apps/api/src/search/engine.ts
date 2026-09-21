/**
 * Bộ máy tìm kiếm sản phẩm — hàm thuần, chạy trên chỉ mục nằm trong bộ nhớ (xem index-store.ts), không đụng DB
 * nên kiểm thử được bằng dữ liệu giả.
 *
 * Vì sao không dùng `LIKE`/FULLTEXT của MySQL: tìm tiếng Việt cần khớp không dấu ("ban phim" ra "Bàn phím"), khớp
 * theo ĐẦU TỪ ("ram" không được ra "LG gram"), khớp mã hàng viết liền hay tách rời ("rtx5070ti" = "RTX 5070 Ti"),
 * hiểu từ đồng nghĩa ("mouse" = "chuột"), sửa lỗi gõ và xếp hạng theo độ liên quan. Mấy việc đó làm trên vài trăm
 * đến vài nghìn sản phẩm trong bộ nhớ vừa nhanh vừa dễ kiểm soát; khi kho lên hàng trăm nghìn mới cần công cụ
 * chuyên dụng (Meilisearch, Elasticsearch).
 */
import { parsePriceIntent, type PriceIntent } from "./price-intent.js";
import { synonymsOf } from "./synonyms.js";
import { accentedForms, editDistance, isModelTerm, normalize, normalizeKeepMarks, tokenize } from "./text.js";

/* -------------------------------------------------------------------------- */
/*  Chỉ mục                                                                   */
/* -------------------------------------------------------------------------- */

export interface SearchDoc {
  id: string;
  slug: string;
  price: number;
  soldCount: number;
  /** Mốc thời gian (ms) để sắp "mới nhất"; 0 nếu chưa có ngày đăng */
  publishedAt: number;
  /** Còn hàng tại thời điểm dựng chỉ mục — chỉ dùng cho điểm xếp hạng; bộ lọc "còn hàng" hỏi lại DB */
  inStock: boolean;
  brand: { slug: string; name: string } | null;
  /** Danh mục lá rồi tới cha, ông: ["ghe", "gaming-gear"] — để lọc theo cả danh mục cha */
  categorySlugs: string[];
  leaf: { slug: string; name: string };

  // Các trường chữ đã chuẩn hoá, MỖI TRƯỜNG BẮT ĐẦU BẰNG MỘT DẤU CÁCH: kiểm tra "bắt đầu một từ" chỉ là
  // `includes(" " + từ)`.
  fName: string;
  /** Tên chữ thường GIỮ dấu, để ưu tiên đúng dấu khi người dùng gõ có dấu ("cơ" trước "có") */
  rawName: string;
  fBrand: string;
  fCategory: string;
  fSpecs: string;
  /** Tên viết liền không dấu cách/chấm, để khớp mã hàng ("rtx5070ti") */
  compactName: string;
  compactAll: string;
}

export interface DocInput {
  id: string;
  slug: string;
  name: string;
  price: number;
  soldCount: number;
  publishedAt: Date | null;
  inStock: boolean;
  brand: { slug: string; name: string } | null;
  /** Từ danh mục lá lên gốc */
  categories: { slug: string; name: string }[];
  /** Chip thông số, giá trị các dòng thông số, mô tả ngắn, mã hàng... */
  extraTexts: string[];
}

export function buildDoc(input: DocInput): SearchDoc {
  const name = normalize(input.name);
  const brand = input.brand ? normalize(input.brand.name) : "";
  const category = input.categories.map((item) => normalize(item.name)).join(" ");
  const specs = normalize(input.extraTexts.join(" "));
  const flat = (text: string) => text.replace(/[ .]/g, "");

  return {
    id: input.id,
    slug: input.slug,
    price: input.price,
    soldCount: input.soldCount,
    publishedAt: input.publishedAt?.getTime() ?? 0,
    inStock: input.inStock,
    brand: input.brand,
    categorySlugs: input.categories.map((item) => item.slug),
    leaf: input.categories[0] ?? { slug: "", name: "" },
    fName: ` ${name}`,
    rawName: ` ${normalizeKeepMarks(input.name)}`,
    fBrand: ` ${brand}`,
    fCategory: ` ${category}`,
    fSpecs: ` ${specs}`,
    compactName: flat(name),
    compactAll: flat(`${name}${brand}${category}${specs}`),
  };
}

export interface IndexCategory {
  slug: string;
  name: string;
  norm: string;
  /** Số sản phẩm cả nhánh */
  count: number;
}

export interface IndexBrand {
  slug: string;
  name: string;
  norm: string;
  count: number;
}

export interface SearchIndex {
  docs: SearchDoc[];
  /** Từ (>= 3 chữ) trong tên, hãng, danh mục → số sản phẩm chứa; nguồn để đoán lời sửa lỗi gõ */
  vocabulary: Map<string, number>;
  categories: IndexCategory[];
  brands: IndexBrand[];
  /**
   * Các từ (không dấu) xuất hiện trong tên danh mục và tên hãng: "laptop", "loa", "ram", "ssd", "razer"... Từ khoá thuộc
   * nhóm này nói lên LOẠI hàng hay HÃNG nên phải khớp ở tên / hãng / danh mục của sản phẩm; chỉ nhắc trong phần thông số
   * thì không tính (laptop có "16GB RAM", tai nghe "dùng cho laptop" không phải kết quả của "ram", "laptop").
   */
  structural: Set<string>;
  builtAt: number;
}

export function buildIndex(docs: SearchDoc[], categories: { slug: string; name: string }[]): SearchIndex {
  const vocabulary = new Map<string, number>();
  const brandCounts = new Map<string, IndexBrand>();
  const categoryCounts = new Map<string, number>();

  for (const doc of docs) {
    const words = new Set(`${doc.fName} ${doc.fBrand} ${doc.fCategory}`.split(" ").filter((word) => word.length >= 3));
    for (const word of words) vocabulary.set(word, (vocabulary.get(word) ?? 0) + 1);

    if (doc.brand) {
      const entry = brandCounts.get(doc.brand.slug) ?? { slug: doc.brand.slug, name: doc.brand.name, norm: normalize(doc.brand.name), count: 0 };
      entry.count++;
      brandCounts.set(doc.brand.slug, entry);
    }
    for (const slug of doc.categorySlugs) categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
  }

  const structural = new Set<string>();
  for (const name of [...categories.map((category) => category.name), ...[...brandCounts.values()].map((brand) => brand.name)]) {
    for (const word of normalize(name).split(" ")) if (word.length >= 2) structural.add(word);
  }

  return {
    docs,
    vocabulary,
    structural,
    brands: [...brandCounts.values()],
    categories: categories.flatMap((category) => {
      const count = categoryCounts.get(category.slug) ?? 0;
      return count > 0 ? [{ slug: category.slug, name: category.name, norm: normalize(category.name), count }] : [];
    }),
    builtAt: Date.now(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Khớp và chấm điểm                                                         */
/* -------------------------------------------------------------------------- */

interface Term {
  term: string;
  /** Cách gọi khác (từ đồng nghĩa), được thử như một vế khác của cùng từ khoá */
  alts: string[];
  /** Từ khoá kiểu mã hàng: so thêm trên dạng viết liền */
  model: boolean;
  /** Nói về loại hàng / hãng (xem SearchIndex.structural): chỉ tính khi khớp ở tên, hãng, danh mục */
  structural: boolean;
  /** Dạng người dùng gõ CÓ dấu, nếu khác dạng không dấu: sản phẩm chứa đúng dấu đó được cộng điểm */
  accented?: string;
}

function isStructural(index: SearchIndex, term: string, alts: string[]): boolean {
  const known = (text: string): boolean => {
    if (/\d/.test(text)) return false;
    if (index.structural.has(text)) return true;
    // Đang gõ dở ("lap" → laptop): chỉ tin khi từ đủ dài, để "co" không dính vào "cooler", "corsair"
    return text.length >= 3 && [...index.structural].some((word) => word.startsWith(text));
  };
  // Cách gọi nhiều từ ("tai nghe", "card man hinh"): cả cụm là tên danh mục thì tính
  return known(term) || alts.some((alt) => alt.split(" ").every((word) => index.structural.has(word)));
}

function specOf(index: SearchIndex, term: string, accents: Map<string, string>): Term {
  const alts = synonymsOf(term);
  return { term, alts, model: isModelTerm(term), structural: isStructural(index, term, alts), accented: accents.get(term) };
}

/** Điểm khớp của một cách viết trong sản phẩm (0 = không có). Tên > hãng > danh mục > thông số. */
function scoreText(doc: SearchDoc, text: string, model: boolean, primaryOnly: boolean): number {
  const needle = ` ${text}`;
  let score = 0;

  if (doc.fName.includes(needle)) {
    score = 10;
    if (doc.fName.startsWith(needle)) score += 2;
    if (doc.fName.includes(`${needle} `) || doc.fName.endsWith(needle)) score += 1;
  } else if (doc.fBrand.includes(needle)) {
    score = 6;
  } else if (doc.fCategory.includes(needle)) {
    score = 5;
  } else if (!primaryOnly && doc.fSpecs.includes(needle)) {
    score = 3;
  }

  if (model) {
    const flat = text.replace(/[ .]/g, "");
    if (score < 8 && doc.compactName.includes(flat)) score = 8;
    else if (score < 2 && !primaryOnly && doc.compactAll.includes(flat)) score = 2;
  }

  return score;
}

/** Cách gọi khác (từ đồng nghĩa) được tính kém một chút so với chính từ người dùng gõ */
const SYNONYM_FACTOR = 0.85;

/** Cộng thêm khi tên sản phẩm chứa đúng dấu người dùng gõ ("cơ" chứ không phải "có") */
const ACCENT_BONUS = 4;

function scoreTerm(doc: SearchDoc, spec: Term): number {
  let best = scoreText(doc, spec.term, spec.model, spec.structural);
  for (const alt of spec.alts) best = Math.max(best, scoreText(doc, alt, false, spec.structural) * SYNONYM_FACTOR);
  if (best > 0 && spec.accented && doc.rawName.includes(` ${spec.accented}`)) best += ACCENT_BONUS;
  return best;
}

const matchesAnything = (docs: SearchDoc[], spec: Term) => docs.some((doc) => scoreTerm(doc, spec) > 0);

const VGA_COMPOUND = " card man hinh";

/**
 * "Card màn hình" là tên gọi của card đồ họa (VGA). Ai tìm "màn hình" mà không nói "card" muốn xem màn hình máy tính,
 * nên với câu đó, cụm này không được tính là "màn hình" trong tên card đồ họa. Trả về chỉ mục tên đã bỏ cụm, còn
 * nguyên các sản phẩm khác; câu tìm "card màn hình" hay "vga" vẫn dùng tên đầy đủ.
 */
function withoutVgaCompound(docs: SearchDoc[]): SearchDoc[] {
  return docs.map((doc) => (doc.fName.includes(VGA_COMPOUND) ? { ...doc, fName: doc.fName.replaceAll(VGA_COMPOUND, " card") } : doc));
}

/** Đoán từ đúng cho một từ khoá gõ sai: từ trong kho ít lỗi nhất, cùng mức lỗi thì chọn từ phổ biến hơn */
function correctTerm(index: SearchIndex, term: string): string | null {
  // Mã hàng ("5071", "rtx9999") không đoán được: đổi một chữ số là ra sản phẩm khác hẳn
  if (term.length < 3 || /\d/.test(term)) return null;

  const limit = term.length <= 4 ? 1 : 2;
  let best: { word: string; distance: number; freq: number } | null = null;

  for (const [word, freq] of index.vocabulary) {
    const distance = editDistance(term, word, limit);
    if (distance > limit) continue;
    if (!best || distance < best.distance || (distance === best.distance && freq > best.freq)) best = { word, distance, freq };
  }

  return best?.word ?? null;
}

export interface ScoredDoc {
  doc: SearchDoc;
  score: number;
  /** Số từ khoá mà sản phẩm chứa */
  matched: number;
}

export interface QueryMatch {
  /** Câu có từ khoá thật (không tính cụm giá)? Không có thì không nên coi là một lần tìm kiếm */
  hasKeywords: boolean;
  /** Từ khoá dùng để khớp: đã sửa lỗi gõ, đã bỏ từ không sản phẩm nào chứa */
  terms: string[];
  /** Từ bị bỏ vì không sản phẩm nào chứa (và không đoán được từ đúng) */
  ignored: string[];
  corrections: { from: string; to: string }[];
  /** true = không sản phẩm nào chứa đủ mọi từ khoá, đây là các sản phẩm khớp nhiều từ nhất */
  relaxed: boolean;
  priceIntent: PriceIntent | null;
  /** Đã xếp theo độ liên quan */
  matches: ScoredDoc[];
}

const byRelevance = (a: ScoredDoc, b: ScoredDoc) =>
  b.score - a.score || b.doc.soldCount - a.doc.soldCount || (a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0);

function nameHas(doc: SearchDoc, spec: Term): boolean {
  if (doc.fName.includes(` ${spec.term}`)) return true;
  if (spec.model && doc.compactName.includes(spec.term.replace(/[ .]/g, ""))) return true;
  return spec.alts.some((alt) => doc.fName.includes(` ${alt}`));
}

/** Điểm cộng ngoài từng từ khoá: cụm liền nhau trong tên, mọi từ đều nằm trong tên, hàng bán chạy và còn hàng */
function bonusOf(doc: SearchDoc, active: Term[]): number {
  let bonus = Math.log10(1 + doc.soldCount) * 1.5 + (doc.inStock ? 1 : 0);

  if (active.length >= 2) {
    const phrase = ` ${active.map((spec) => spec.term).join(" ")}`;
    if (doc.fName.includes(phrase)) {
      bonus += 12;
      if (doc.fName.startsWith(phrase)) bonus += 6;
    }
    if (active.every((spec) => nameHas(doc, spec))) bonus += 6;
  }

  return bonus;
}

/**
 * Tìm sản phẩm khớp một câu tìm kiếm.
 *
 * Các bước: (1) tách cụm giá ("dưới 30 triệu") ra khỏi từ khoá; (2) từ khoá nào KHÔNG sản phẩm nào chứa thì thử sửa
 * lỗi gõ, không sửa được thì bỏ qua thay vì làm cả câu ra trống; (3) sản phẩm phải chứa MỌI từ khoá còn lại; nếu
 * không có sản phẩm nào như vậy thì hạ xuống các sản phẩm chứa nhiều từ nhất (`relaxed`).
 */
export function matchQuery(index: SearchIndex, query: string): QueryMatch {
  const priceIntent = parsePriceIntent(query);
  const text = priceIntent ? priceIntent.rest : query;
  const keywords = tokenize(text);
  const accents = accentedForms(text);

  if (keywords.length === 0) {
    // Chỉ có cụm giá ("dưới 5 triệu"): xem mọi sản phẩm, xếp bán chạy trước; không có gì hết thì không có kết quả
    const matches = priceIntent ? index.docs.map((doc): ScoredDoc => ({ doc, score: bonusOf(doc, []), matched: 0 })).sort(byRelevance) : [];
    return { hasKeywords: false, terms: [], ignored: [], corrections: [], relaxed: false, priceIntent, matches };
  }

  const saysScreen = (keywords.includes("man") && keywords.includes("hinh")) || keywords.includes("monitor") || keywords.includes("display");
  const wantsScreen = saysScreen && !keywords.includes("card") && !keywords.includes("vga");
  const docs = wantsScreen ? withoutVgaCompound(index.docs) : index.docs;

  const active: Term[] = [];
  const ignored: string[] = [];
  const corrections: { from: string; to: string }[] = [];

  for (const keyword of keywords) {
    const spec = specOf(index, keyword, accents);
    if (matchesAnything(docs, spec)) {
      active.push(spec);
      continue;
    }

    const fixed = correctTerm(index, keyword);
    if (fixed && !active.some((existing) => existing.term === fixed)) {
      corrections.push({ from: keyword, to: fixed });
      active.push(specOf(index, fixed, accents));
    } else if (!fixed) {
      ignored.push(keyword);
    }
  }

  if (active.length === 0) {
    return { hasKeywords: true, terms: [], ignored, corrections, relaxed: false, priceIntent, matches: [] };
  }

  const scored: ScoredDoc[] = [];
  for (const doc of docs) {
    let matched = 0;
    let score = 0;
    for (const spec of active) {
      const termScore = scoreTerm(doc, spec);
      if (termScore > 0) {
        matched++;
        score += termScore;
      }
    }
    if (matched > 0) scored.push({ doc, matched, score: score + bonusOf(doc, active) });
  }

  const complete = scored.filter((item) => item.matched === active.length);
  let matches = complete;
  let relaxed = false;

  if (complete.length === 0) {
    // Câu ngắn được lệch một từ; câu dài (từ 5 từ) cần khớp ít nhất 60%
    const needed = active.length <= 4 ? Math.max(1, active.length - 1) : Math.ceil(active.length * 0.6);
    matches = scored.filter((item) => item.matched >= needed).sort((a, b) => b.matched - a.matched || byRelevance(a, b));
    relaxed = true;
  } else {
    matches = [...complete].sort(byRelevance);
  }

  return { hasKeywords: true, terms: active.map((spec) => spec.term), ignored, corrections, relaxed, priceIntent, matches };
}

/* -------------------------------------------------------------------------- */
/*  Bộ lọc, sắp xếp, bộ lọc thành phần (facet)                                */
/* -------------------------------------------------------------------------- */

export interface Filters {
  /** Slug danh mục (lá hoặc cha) */
  category?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
}

type FilterKey = "category" | "brand" | "price";

/** Lọc kết quả; `skip` bỏ qua một loại bộ lọc — để đếm thành phần của chính loại đó */
export function filterMatches(matches: ScoredDoc[], filters: Filters, skip?: FilterKey): ScoredDoc[] {
  const brands = filters.brands && filters.brands.length > 0 ? new Set(filters.brands) : null;

  return matches.filter(({ doc }) => {
    if (skip !== "category" && filters.category && !doc.categorySlugs.includes(filters.category)) return false;
    if (skip !== "brand" && brands && !(doc.brand && brands.has(doc.brand.slug))) return false;
    if (skip !== "price") {
      if (filters.minPrice !== undefined && doc.price < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && doc.price > filters.maxPrice) return false;
    }
    return true;
  });
}

export type SearchSort = "relevance" | "best-selling" | "newest" | "price-asc" | "price-desc";

/** Khoá phụ `id` như mọi kiểu sắp xếp khác của API: sang trang 2 không lặp hay sót sản phẩm */
const byId = (a: ScoredDoc, b: ScoredDoc) => (a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0);

export function sortMatches(matches: ScoredDoc[], sort: SearchSort): ScoredDoc[] {
  if (sort === "relevance") return matches;

  const compare: Record<Exclude<SearchSort, "relevance">, (a: ScoredDoc, b: ScoredDoc) => number> = {
    "best-selling": (a, b) => b.doc.soldCount - a.doc.soldCount || byId(a, b),
    newest: (a, b) => b.doc.publishedAt - a.doc.publishedAt || byId(a, b),
    "price-asc": (a, b) => a.doc.price - b.doc.price || byId(a, b),
    "price-desc": (a, b) => b.doc.price - a.doc.price || byId(a, b),
  };
  return [...matches].sort(compare[sort]);
}

export interface Facets {
  categories: { slug: string; name: string; count: number }[];
  brands: { slug: string; name: string; count: number }[];
  priceRange: { min: number; max: number } | null;
}

function countBy(items: ScoredDoc[], pick: (doc: SearchDoc) => { slug: string; name: string } | null) {
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const { doc } of items) {
    const key = pick(doc);
    if (!key) continue;
    const entry = counts.get(key.slug) ?? { slug: key.slug, name: key.name, count: 0 };
    entry.count++;
    counts.set(key.slug, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
}

/**
 * Thành phần của bộ lọc: mỗi loại đếm trên kết quả đã áp CÁC bộ lọc KHÁC (nhưng không áp chính nó), để chọn một
 * hãng không làm danh sách hãng chỉ còn đúng hãng đó, và số bên cạnh mỗi lựa chọn luôn là số sản phẩm sẽ thấy.
 */
export function buildFacets(matches: ScoredDoc[], filters: Filters): Facets {
  const forPrice = filterMatches(matches, filters, "price");
  let min = Infinity;
  let max = -Infinity;
  for (const { doc } of forPrice) {
    min = Math.min(min, doc.price);
    max = Math.max(max, doc.price);
  }

  return {
    categories: countBy(filterMatches(matches, filters, "category"), (doc) => (doc.leaf.slug ? doc.leaf : null)),
    brands: countBy(filterMatches(matches, filters, "brand"), (doc) => doc.brand),
    priceRange: forPrice.length > 0 ? { min, max } : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Gợi ý khi gõ                                                              */
/* -------------------------------------------------------------------------- */

/** Danh mục có tên chứa mọi từ khoá (theo đầu từ, kể cả từ đồng nghĩa): "ghe" → Ghế, "mouse" → Chuột */
export function suggestCategories(index: SearchIndex, terms: string[], limit: number): IndexCategory[] {
  if (terms.length === 0) return [];
  const specs = terms.map((term) => specOf(index, term, new Map()));
  return index.categories
    .filter((category) => specs.every((spec) => [spec.term, ...spec.alts].some((text) => ` ${category.norm}`.includes(` ${text}`))))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"))
    .slice(0, limit);
}

/** Hãng có tên chứa mọi từ khoá (theo đầu từ): "raz" → Razer */
export function suggestBrands(index: SearchIndex, terms: string[], limit: number): IndexBrand[] {
  if (terms.length === 0) return [];
  return index.brands
    .filter((brand) => terms.every((term) => ` ${brand.norm}`.includes(` ${term}`)))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"))
    .slice(0, limit);
}
