/**
 * So khớp tên sản phẩm của shop với model trong danh mục chính hãng.
 *
 * Code cũ dùng `pageName.includes(expectedModel)` sau khi bỏ hết ký tự đặc biệt.
 * Cách đó sai ở hai chiều:
 *
 *   "B760M GAMING X"     khớp nhầm trang "B760M GAMING X AX"   (thiếu -> vẫn nhận)
 *   "B760M Pro RS DDR5"  trượt trang "B760M Pro RS"            (thừa -> không nhận)
 *
 * Cách làm ở đây: tách thành token, yêu cầu **mọi token của model chính hãng đều
 * có trong tên shop**, rồi chấm điểm theo số token khớp được. Ứng viên nào khớp
 * được nhiều token nhất thì thắng; nếu hai ứng viên bằng điểm thì từ chối và
 * đánh dấu cần người rà, vì đoán sai ảnh tệ hơn là không có ảnh.
 */

/** Từ bị loại khỏi phép so khớp: tên hãng, loại linh kiện, tiếng Việt của shop. */
const STOPWORDS = new Set([
  // loại linh kiện
  "MAINBOARD", "MOTHERBOARD", "BO", "MACH", "CHU", "BOMACHCHU",
  "VGA", "CARD", "MAN", "HINH", "CARDMANHINH", "GRAPHICS",
  "VIDEO", "GPU",
  // tên hãng
  "ASROCK", "GIGABYTE", "AORUS", "MSI", "ASUS", "COLORFUL",
  "INNO3D", "GALAX", "ZOTAC", "PALIT", "SAPPHIRE", "POWERCOLOR",
  // từ tiếp thị shop hay thêm
  "CHINH", "HANG", "NEW", "MOI", "FULLBOX", "BAO", "HANH",
  "CHINHHANG",
]);

/**
 * Token biến thể: nếu tên shop chỉ rõ một biến thể thì model chính hãng phải
 * khớp đúng biến thể đó, không được lấy bản gốc thay thế.
 */
const VARIANT_ALIASES: Record<string, string[]> = {
  DDR4: ["D4"],
  DDR5: ["D5"],
  D4: ["DDR4"],
  D5: ["DDR5"],
};

const VARIANT_TOKENS = new Set(["DDR4", "DDR5", "D4", "D5"]);

/** Bỏ dấu tiếng Việt để "bo mạch chủ" -> "bo mach chu". */
function stripVietnameseDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Tách tên sản phẩm thành các token đã chuẩn hoá.
 *
 *   "Mainboard ASRock B760M Pro RS DDR5"  ->  ["B760M", "PRO", "RS", "DDR5"]
 *   "GeForce RTX 4060 Ti EAGLE OC 8G"     ->  ["GEFORCE","RTX","4060","TI","EAGLE","OC","8G"]
 */
export function tokenize(productName: string): string[] {
  const cleaned = stripVietnameseDiacritics(productName)
    .toUpperCase()
    // ngoặc và dấu phân cách đều thành khoảng trắng
    .replace(/[()[\]{}]/g, " ")
    .replace(/[\/\\_,+]/g, " ")
    // "REV. 1.0" / "REV 1.0" là thông tin revision, bỏ đi
    .replace(/\bREV\.?\s*[0-9.]+\b/g, " ")
    // giữ lại chữ, số và dấu gạch ngang trong model (VD: X670E-PRO)
    .replace(/[^A-Z0-9-]/g, " ")
    .replace(/-+/g, " ")
    .trim();

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token));
}

/** Một token của shop có thoả token của model chính hãng không (kể cả alias). */
function tokenSatisfies(shopTokens: Set<string>, officialToken: string): boolean {
  if (shopTokens.has(officialToken)) return true;
  const aliases = VARIANT_ALIASES[officialToken];
  return aliases ? aliases.some((a) => shopTokens.has(a)) : false;
}

export interface CatalogEntry {
  /** Tên model đúng như hãng công bố, VD "B760M Pro RS" */
  model: string;
  /** URL trang sản phẩm chính hãng — đọc được từ sitemap/trang danh sách, không đoán */
  url: string;
}

export interface MatchResult {
  entry: CatalogEntry;
  /** Số token của model chính hãng khớp được */
  score: number;
  /** Token trong tên shop không dùng tới — càng ít càng sát */
  leftover: number;
  /** Ứng viên đứng nhì, để ghi vào log kiểm tra */
  runnerUp?: { model: string; score: number };
  /** Khớp được nhưng có điểm đáng ngờ -> đánh dấu needsReview cho admin rà */
  warning?: string;
}

export type MatchOutcome =
  | { status: "MATCHED"; result: MatchResult }
  | { status: "AMBIGUOUS"; candidates: string[] }
  | { status: "NOT_FOUND" };

/**
 * Tìm model chính hãng khớp với tên sản phẩm của shop.
 *
 * @param productName tên lấy từ KCCShop, VD "Mainboard ASRock B760M Pro RS DDR5"
 * @param catalog     danh mục model của hãng, dựng sẵn từ sitemap / trang danh sách
 */
export function matchProduct(
  productName: string,
  catalog: CatalogEntry[]
): MatchOutcome {
  const shopTokens = tokenize(productName);
  if (shopTokens.length === 0) return { status: "NOT_FOUND" };

  const shopSet = new Set(shopTokens);

  // Tên shop có chỉ rõ biến thể DDR không?
  const wantedVariant = shopTokens.find((t) => VARIANT_TOKENS.has(t));

  const scored: MatchResult[] = [];

  for (const entry of catalog) {
    const officialTokens = tokenize(entry.model);
    if (officialTokens.length === 0) continue;

    // ĐIỀU KIỆN BẮT BUỘC: mọi token của model chính hãng phải có trong tên shop.
    // Đây chính là chỗ chặn "B760M GAMING X" khớp nhầm "B760M GAMING X AX".
    const allPresent = officialTokens.every((t) => tokenSatisfies(shopSet, t));
    if (!allPresent) continue;

    scored.push({
      entry,
      score: officialTokens.length,
      leftover: shopTokens.length - officialTokens.length,
    });
  }

  if (scored.length === 0) return { status: "NOT_FOUND" };

  // Khớp nhiều token nhất thắng; bằng nhau thì ít token thừa hơn thắng.
  scored.sort((a, b) => b.score - a.score || a.leftover - b.leftover);

  const best = scored[0];
  const second = scored[1];

  // Hai ứng viên ngang điểm => không đủ căn cứ, để người rà.
  if (second && second.score === best.score && second.leftover === best.leftover) {
    return {
      status: "AMBIGUOUS",
      candidates: scored
        .filter((s) => s.score === best.score && s.leftover === best.leftover)
        .map((s) => s.entry.model),
    };
  }

  /*
   * Cảnh báo mềm về biến thể.
   *
   * Hãng thường đặt tên bản mặc định KHÔNG có hậu tố ("B760M Pro RS" chính là
   * bản DDR5) và bản thay thế mới mang hậu tố ("B760M Pro RS/D4"). Cơ chế alias
   * ở trên đã xử lý đúng cả hai chiều, nên ở đây KHÔNG chặn — chỉ đánh dấu để
   * admin rà lại khi shop ghi rõ biến thể mà model thắng cuộc không mang hậu tố
   * và hãng lại có bản hậu tố khác. Chặn ở đây sẽ loại oan bản mặc định.
   */
  let warning: string | undefined;

  if (wantedVariant) {
    const bestTokens = tokenize(best.entry.model);
    const bestHasVariant = bestTokens.some((t) => VARIANT_TOKENS.has(t));

    if (!bestHasVariant) {
      const hasVariantSibling = catalog.some((e) => {
        const t = tokenize(e.model);
        return (
          t.some((x) => VARIANT_TOKENS.has(x)) &&
          bestTokens.every((bt) => t.includes(bt))
        );
      });

      if (hasVariantSibling) {
        warning =
          `Shop ghi "${wantedVariant}" nhưng model khớp không có hậu tố biến thể; ` +
          `hãng có bản biến thể khác. Nhiều khả năng đúng (bản mặc định), nên rà lại.`;
      }
    }
  }

  return {
    status: "MATCHED",
    result: {
      ...best,
      runnerUp: second ? { model: second.entry.model, score: second.score } : undefined,
      warning,
    },
  };
}