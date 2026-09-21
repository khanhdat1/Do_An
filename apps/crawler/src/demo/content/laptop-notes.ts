/**
 * Lời giải thích ngắn về từng thành phần của laptop (chip, card đồ họa, màn hình, RAM, ổ cứng).
 *
 * Nhiều laptop demo chỉ có thông số đọc từ tên sản phẩm (CPU, card, RAM, SSD, màn hình, hệ điều hành), không có
 * cân nặng, pin, cổng kết nối. Để bài mô tả vẫn đủ dài và có ích, mỗi thông số có kèm vài câu kiến thức phổ thông về
 * nó: hậu tố "HX" nghĩa là gì, RTX 50 khác RTX 40 ở đâu, màn OLED hợp việc gì... Chỉ viết những điều đúng với mọi máy
 * dùng thành phần đó, không nói gì về riêng model này ngoài các thông số đã có.
 */
import { firstNumber } from "../attributes.js";

/** Hậu tố cuối tên chip ("13620H" → "H", "8940HX" → "HX", "7735HS" → "HS", "226V" → "V"); không có thì undefined */
function cpuSuffix(cpu: string): string | undefined {
  return cpu.match(/(?<![\p{L}\p{N}])[A-Za-z]?\d{3,5}([A-Z]{1,2})(?![\p{L}\p{N}])/u)?.[1];
}

/** Đoạn giải thích về dòng chip và hậu tố hiệu năng của CPU laptop */
export function cpuNote(cpuFull: string | undefined): string | undefined {
  if (!cpuFull) return undefined;
  const cpu = cpuFull.split(" (")[0];
  const notes: string[] = [];

  if (/core ultra/i.test(cpu)) {
    notes.push("Dòng Core Ultra có thêm NPU (bộ xử lý thần kinh) để chạy các tính năng AI ngay trên máy, như làm mờ nền webcam hay khử ồn micro, mà ít tốn pin hơn chạy bằng CPU.");
  } else if (/ryzen ai max/i.test(cpu)) {
    notes.push("Ryzen AI Max+ kết hợp nhân đồ họa tích hợp rất mạnh với NPU cho các tác vụ AI, cho phép máy gọn mà vẫn chơi game và dựng hình tốt.");
  } else if (/ryzen ai/i.test(cpu)) {
    notes.push("Dòng Ryzen AI có thêm NPU chuyên cho các tính năng AI chạy ngay trên máy, giúp các tác vụ này tiết kiệm điện hơn.");
  } else if (/snapdragon/i.test(cpu)) {
    notes.push("Chip Snapdragon dùng kiến trúc ARM: rất tiết kiệm điện và mát, pin thường bền; một số phần mềm cũ chạy qua lớp giả lập nên hãy kiểm tra các ứng dụng bạn cần trước khi mua.");
  }

  switch (cpuSuffix(cpu)) {
    case "HX":
      notes.push("Hậu tố HX là nhóm chip laptop mạnh nhất của hãng: nhiều nhân, công suất cao, gần với chip máy bàn, dành cho máy gaming và máy đồ họa cần hiệu năng lớn.");
      break;
    case "H":
      notes.push("Hậu tố H là nhóm chip hiệu năng cao cho laptop, mạnh hơn hẳn các dòng tiết kiệm điện hậu tố U, phù hợp chơi game, dựng hình và đa nhiệm nặng.");
      break;
    case "HS":
      notes.push("Hậu tố HS là nhóm chip hiệu năng cao nhưng ở mức công suất vừa phải, cân bằng giữa sức mạnh và thời lượng pin.");
      break;
    case "U":
    case "V":
    case "P":
      notes.push("Hậu tố này thuộc nhóm chip tiết kiệm điện, ưu tiên thời lượng pin và thân máy mỏng nhẹ hơn hiệu năng đỉnh; rất hợp học tập, văn phòng và làm việc di động.");
      break;
    default:
  }

  return notes.length > 0 ? notes.join(" ") : undefined;
}

/** Giải thích về card đồ họa rời NVIDIA RTX: đời (30/40/50), phân khúc và dung lượng bộ nhớ */
export function gpuNote(gpuFull: string | undefined): string | undefined {
  if (!gpuFull) return undefined;
  const match = gpuFull.match(/RTX\s*(\d{2})(\d{2})/i);
  if (!match) return undefined;

  const seriesNotes: Record<string, string> = { "50": "Dòng RTX 50 dùng kiến trúc Blackwell, hỗ trợ DLSS 4 với Multi Frame Generation để tạo thêm khung hình cùng Ray Tracing thế hệ mới.", "40": "Dòng RTX 40 dùng kiến trúc Ada Lovelace, hỗ trợ DLSS 3 với Frame Generation và Ray Tracing.", "30": "Dòng RTX 30 dùng kiến trúc Ampere, hỗ trợ Ray Tracing và DLSS." };
  const tierNotes: Record<string, string> =
    {
      "50": "Đây là phân khúc phổ thông của laptop gaming: chơi tốt game eSports và phần lớn game AAA ở Full HD với thiết lập vừa phải.",
      "60": "Đây là phân khúc tầm trung được nhiều game thủ chọn: chơi mượt hầu hết game ở Full HD và nhiều game ở QHD.",
      "70": "Đây là phân khúc cao cấp, dư sức cho Full HD và QHD ở thiết lập cao.",
      "80": "Đây là nhóm hàng đầu của laptop, dành cho chơi game ở độ phân giải cao, dựng hình và các tác vụ AI.",
      "90": "Đây là nhóm hàng đầu của laptop, dành cho chơi game ở độ phân giải cao, dựng hình và các tác vụ AI.",
    };
  const series = seriesNotes[match[1]];
  const tier = tierNotes[match[2]];

  const vram = firstNumber(gpuFull.match(/(\d{1,2})\s*GB/i)?.[0]);
  const memory =
    vram === undefined
      ? undefined
      : vram <= 4
        ? `Bộ nhớ đồ họa ${vram} GB đủ cho game eSports và nhiều game Full HD nhẹ; với game mới nên hạ thiết lập texture.`
        : vram <= 6
          ? `Bộ nhớ đồ họa ${vram} GB đủ cho phần lớn game Full HD hiện nay.`
          : vram <= 8
            ? `Bộ nhớ đồ họa ${vram} GB là mức thoải mái cho game Full HD và QHD hiện nay.`
            : `Bộ nhớ đồ họa ${vram} GB dư dả cho texture độ phân giải cao, dựng hình và các tác vụ AI.`;

  const text = [series, tier, memory].filter(Boolean).join(" ");
  return text === "" ? undefined : text;
}

/** Những điều nên biết về màn hình: cỡ, tỷ lệ, tần số quét, loại tấm nền, độ phân giải */
export function screenNotes(size: string | undefined, res: string | undefined, hz: string | undefined, panel: string | undefined): string[] {
  const notes: string[] = [];
  const inches = firstNumber(size);
  const rate = firstNumber(hz);

  if (size && inches !== undefined) {
    notes.push(
      inches <= 14.5
        ? `Cỡ ${size} gọn, dễ mang theo và đặt vừa balo, hợp người thường xuyên di chuyển.`
        : inches < 16
          ? `Cỡ ${size} là cỡ phổ biến nhất: đủ rộng để làm việc thoải mái mà thân máy không quá lớn.`
          : `Cỡ ${size} rộng rãi, xem nhiều cửa sổ cùng lúc thoải mái hơn nhưng thân máy cũng lớn và nặng hơn.`,
    );
  }
  // Chỉ những nhãn/kích thước chắc chắn là 16:10 ("QHD+", "3K" có nơi 16:9, có nơi 16:10 nên không nêu)
  if (res && /wuxga|wqxga|wquxga|fhd\+|1920x1200|2560x1600|3840x2400/i.test(res)) {
    notes.push("Tỷ lệ 16:10 hiển thị thêm nhiều dòng hơn màn 16:9, tiện cho lướt web, đọc tài liệu và viết mã.");
  }
  if (res && /full hd|1920x1080/i.test(res)) {
    notes.push("Độ phân giải Full HD đủ sắc nét ở cỡ màn hình laptop và nhẹ tải cho card đồ họa, giúp game đạt số khung hình cao hơn.");
  } else if (res && /wqxga|wquxga|2k|qhd|2\.5k|2\.8k|3k|4k|2560|2880|3840/i.test(res)) {
    notes.push("Độ phân giải cao cho hình ảnh và chữ sắc nét, đổi lại máy tiêu tốn nhiều điện hơn và game nặng đòi hỏi card đồ họa mạnh hơn.");
  }
  if (rate !== undefined) {
    if (rate >= 240) notes.push(`Tần số quét ${hz} rất cao, dành cho game thủ eSports; để tận dụng, game cần đạt số khung hình tương ứng.`);
    else if (rate >= 120) notes.push(`Tần số quét ${hz} cho chuyển động mượt hơn hẳn màn 60 Hz khi chơi game bắn súng, đua xe và cả khi cuộn trang.`);
  }
  if (panel && /oled/i.test(panel)) {
    notes.push("Tấm nền OLED cho màu đen sâu, độ tương phản rất cao và màu sắc rực rỡ, hợp xem phim, chỉnh ảnh và thiết kế; nên dùng chế độ tối và để màn hình tự tắt khi không dùng để màn bền hơn.");
  } else if (panel && /mini\s*led/i.test(panel)) {
    notes.push("Tấm nền Mini LED có nhiều vùng đèn nền cục bộ, độ sáng cao và độ tương phản tốt, đặc biệt đẹp khi xem nội dung HDR.");
  } else if (panel && /ips/i.test(panel)) {
    notes.push("Tấm nền IPS cho góc nhìn rộng và màu sắc ổn định ngay cả khi nhìn nghiêng.");
  }

  return notes;
}

/** RAM: mức dung lượng hợp với nhu cầu nào */
export function memoryNote(ram: string | undefined): string | undefined {
  const gb = firstNumber(ram);
  if (gb === undefined) return undefined;
  if (gb <= 8) return `RAM ${ram} đủ cho học tập, văn phòng và duyệt web vừa phải; nếu hay mở nhiều tab hoặc chạy phần mềm nặng, hãy cân nhắc cấu hình RAM lớn hơn hoặc hỏi PCZone về khả năng nâng cấp.`;
  if (gb <= 16) return `RAM ${ram} là mức cân bằng cho đa số nhu cầu: đa nhiệm mượt và chơi game hiện đại thoải mái.`;
  return `RAM ${ram} dư dả cho dựng video, đồ họa 3D, chạy máy ảo và vừa chơi game vừa livestream.`;
}

/** Ổ SSD: dung lượng đủ dùng cho việc gì (đầu vào đã là "512 GB" hay "1 TB") */
export function storageNote(ssd: string | undefined): string | undefined {
  if (!ssd) return undefined;
  const value = firstNumber(ssd);
  if (value === undefined) return undefined;
  const gb = /tb/i.test(ssd) ? value * 1000 : value;
  if (gb <= 256) return `Ổ SSD ${ssd} đủ cài Windows và các ứng dụng cần thiết nhưng nhanh đầy nếu cài nhiều game; bạn có thể dùng thêm ổ cứng ngoài hoặc lưu trữ đám mây.`;
  if (gb <= 512) return `Ổ SSD ${ssd} đủ cài hệ điều hành, phần mềm làm việc và vài tựa game lớn.`;
  return `Ổ SSD ${ssd} rộng rãi để chứa thư viện game, dự án video và dữ liệu làm việc mà không lo hết chỗ.`;
}
