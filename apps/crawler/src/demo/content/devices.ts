/**
 * Nội dung cho nhóm thiết bị hoàn chỉnh: laptop, PC lắp ráp, màn hình, bàn phím, chuột.
 * Mỗi hàm nhận thông số của một sản phẩm và trả về `Draft` (xem common.ts).
 */
import { firstNumber, firstPart, formatCapacity, toGigabytes } from "../attributes.js";
import { pcParts, pickVariant } from "../names.js";
import { compact, midSentence, noDot, paragraph, warrantyMonths, type Ctx, type Draft } from "./common.js";

const tight = (value: string | undefined) => value?.replace(/\s+/g, "");
const lower = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/* -------------------------------------------------------------------------- */
/*  Laptop                                                                    */
/* -------------------------------------------------------------------------- */

/** Bỏ chữ thừa nguồn hay thêm sau tên chip: "Ryzen 9 8940HX Processor" */
const stripProcessor = (cpu: string) => cpu.replace(/\s+processor\b/i, "").trim();

/** "Intel Core 5 210H (8 lõi / 12 luồng…)" → "Core 5 210H" */
function shortCpu(cpu: string | undefined): string | undefined {
  return cpu
    ? stripProcessor(cpu.split(" (")[0].replace(/^(intel|amd)\s+/i, "").replace(/\s+\d+(?:\.\d+)?\s*GHz.*$/i, ""))
    : undefined;
}

/**
 * Phần trong ngoặc của CPU laptop ("80MB Cache / up to 5.3 GHz / 16 cores / 32 Threads") viết bằng
 * đủ kiểu tiếng Anh, tiếng Việt lẫn lộn. Chỉ lấy ba con số đáng tin (nhân, luồng, xung tối đa) rồi tự
 * viết lại bằng tiếng Việt; không rút ra được gì thì bỏ hẳn phần ngoặc thay vì in nguyên chuỗi lạ.
 */
function cpuDetailVi(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const cores = detail.match(/(\d+)\s*(?:cores?|lõi|nhân)\b/i)?.[1];
  const threads = detail.match(/(\d+)\s*(?:threads?|luồng)\b/i)?.[1];
  const boost = detail.match(/(?:up\s*to|tối đa|-)\s*(\d+(?:\.\d+)?)\s*GHz/i)?.[1];
  const parts = compact([cores && threads ? `${cores} nhân ${threads} luồng` : cores && `${cores} nhân`, boost && `xung nhịp tối đa ${boost} GHz`]);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** "NVIDIA GeForce RTX 3050 4GB GDDR6" → "RTX 3050"; card tích hợp giữ tên gọn */
function shortGpu(gpu: string | undefined): string | undefined {
  if (!gpu) return undefined;
  const rtx = gpu.match(/\b(RTX|GTX)\s*\d{4}(?:\s*(?:Ti|SUPER))?/i);
  if (rtx) return rtx[0].replace(/\s+/g, " ");
  return gpu.replace(/^(nvidia|amd|intel)\s+/i, "").replace(/\s+graphics$/i, "").trim();
}

function laptop(ctx: Ctx, gaming: boolean): Draft {
  const { name, brand, a, seed } = ctx;
  const cpuFull = a.get(/^CPU$/);
  const cpu = cpuFull ? stripProcessor(cpuFull.split(" (")[0].replace(/\s+\d+(?:\.\d+)?\s*GHz.*$/i, "")) : undefined;
  const cpuDetail = cpuDetailVi(cpuFull?.match(/\(([^)]*)\)?/)?.[1]);
  const gpuFull = firstPart(a.get(/^Card đồ họa$/));
  const gpuShortName = shortGpu(gpuFull);
  const discrete = gpuFull !== undefined && /(rtx|gtx|geforce)/i.test(gpuFull);
  const ram = a.get(/^Dung lượng RAM$/, /^RAM$/);
  const ramType = a.get(/^Loại RAM$/);
  const ramBus = a.get(/^Bus RAM$/);
  const ramMax = a.get(/^RAM nâng cấp tối đa$/);
  const ssdGb = toGigabytes(a.get(/^Dung lượng SSD$/, /^SSD$/));
  const ssd = ssdGb ? formatCapacity(ssdGb) : undefined;
  const ssdStd = a.get(/^Chuẩn giao tiếp SSD$/, /^Chuẩn SSD$/);
  const ssdMaxGb = toGigabytes(a.get(/^SSD nâng cấp tối đa$/));
  const size = a.get(/^Kích thước màn hình$/);
  const res = a.get(/^Độ phân giải$/);
  const hz = a.get(/^Tần số quét$/);
  const panel = a.get(/^Tấm nền$/);
  const brightness = a.get(/^Độ sáng màn hình$/);
  const gamut = a.get(/^Chuẩn màu$/, /^Độ phủ sRGB$/);
  const webcam = a.get(/^Webcam$/);
  const keyboard = firstPart(a.get(/^Bàn phím có đèn$/, /^Đèn bàn phím$/));
  const os = a.get(/^Hệ điều hành$/);
  const battery = a.get(/^Pin$/);
  const batteryWh = a.get(/^Dung lượng pin$/);
  const weight = a.get(/^Trọng lượng$/);
  const dims = a.get(/^Kích thước máy$/);
  const ports = a.get(/^Cổng kết nối$/);
  const wifi = a.get(/^Chuẩn WIFI$/, /^Chuẩn Wifi\/Bluetooth$/);
  const bluetoothRaw = a.get(/^Bluetooth$/);
  // Nguồn ghi riêng "5.3" hoặc "Bluetooth 5.3"
  const bluetooth = bluetoothRaw && /^\d/.test(bluetoothRaw) ? `Bluetooth ${bluetoothRaw}` : bluetoothRaw;
  const usage = a.get(/^Nhu cầu sử dụng( laptop)?$/)?.toLowerCase();
  const resShort = res?.match(/^(Full HD\+?|WUXGA|2K\+?|QHD\+?|WQXGA|3K|4K|FHD\+?|OLED)/i)?.[1] ?? res?.split(" (")[0];
  const screen = size ? `${size.replace(/\s*inch/i, '"')}${resShort ? ` ${resShort}` : ""}${hz ? ` ${tight(hz)}` : ""}` : undefined;
  const cpuShortName = shortCpu(cpuFull);

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là mẫu laptop${gaming ? " gaming" : ""}${brand ? ` của ${brand}` : ""} trang bị ${cpu ?? "vi xử lý mới"}${gpuFull && gaming ? ` cùng card đồ họa ${gpuFull}` : ""}${ram ? `, RAM ${ram}${ramType ? ` ${ramType}` : ""}` : ""}${ssd ? ` và ổ SSD ${ssd}` : ""}.`,
      screen && `Máy có màn hình ${screen}, ${gaming ? "cho hình ảnh mượt và sắc nét trong game lẫn khi làm việc" : "đủ rộng và sáng cho học tập, làm việc mỗi ngày"}.`,
    ),
    paragraph(
      gaming
        ? `Muốn một chiếc laptop chơi được game hiện đại mà vẫn mang đi học, đi làm được, ${midSentence(name)} là ứng viên đáng xem.`
        : `Một chiếc laptop gọn nhẹ, đủ mạnh cho công việc hằng ngày là thứ mà sinh viên và dân văn phòng cần nhất. ${name} nhắm đúng nhu cầu đó.`,
      cpu && `Máy dùng ${cpu}${gpuShortName && discrete ? ` và ${gpuShortName}` : ""}${ram ? `, ${ram} RAM` : ""}${ssd ? `, ${ssd} SSD` : ""}.`,
    ),
  ]);

  const performance = paragraph(
    cpu && `${cpu} là bộ xử lý ${gaming ? "hiệu năng cao dành cho laptop, đủ sức xử lý game, livestream và các tác vụ đa nhiệm" : "tiết kiệm điện cho laptop, đáp ứng tốt văn phòng, học online, xem phim và duyệt web nhiều tab"}${cpuDetail ? ` (${cpuDetail})` : ""}.`,
    discrete && gpuFull && `Card đồ họa rời ${gpuFull} ${/rtx/i.test(gpuFull) ? "hỗ trợ Ray Tracing và các công nghệ tăng khung hình bằng AI như DLSS trong những game được hỗ trợ" : "cho hiệu năng đồ họa vượt xa đồ họa tích hợp"}, đồng thời tăng tốc dựng video và thiết kế.`,
    !discrete && gpuFull && `Máy dùng đồ họa tích hợp ${gpuFull}, tiết kiệm điện và đủ cho xem phim, làm việc văn phòng, chỉnh sửa ảnh cơ bản.`,
    ram && `${ram} RAM${ramType ? ` ${ramType}` : ""}${ramBus ? ` bus ${ramBus}` : ""} giúp máy đa nhiệm mượt${ramMax ? `, có thể nâng cấp tối đa ${ramMax}` : ""}.`,
  );

  return {
    titleParts: [cpuShortName, discrete ? gpuShortName : undefined, ram && `${tight(ram)}`, ssd && `SSD ${tight(ssd)}`, screen],
    intro,
    sections: [
      { heading: gaming ? "Hiệu năng chơi game và sáng tạo" : "Hiệu năng cho học tập và làm việc", paragraphs: [performance] },
      {
        heading: "Màn hình hiển thị",
        paragraphs: [
          paragraph(
            size && `Màn hình ${size}${res ? `, độ phân giải ${res}` : ""}${panel ? `, tấm nền ${panel}` : ""}${hz ? `, tần số quét ${hz}` : ""}.`,
            hz && firstNumber(hz) !== undefined && (firstNumber(hz) as number) >= 120 && "Tần số quét cao cho chuyển động mượt, giảm nhòe hình khi di chuột nhanh, chơi game hay cuộn trang.",
            brightness && `Độ sáng ${brightness}${gamut ? `, ${lower(gamut)}` : ""}.`,
            !brightness && gamut && `Độ phủ màu: ${gamut}.`,
          ),
        ],
      },
      {
        heading: "Lưu trữ và khả năng nâng cấp",
        paragraphs: [
          paragraph(
            ssd && `Ổ SSD ${ssd}${ssdStd ? ` chuẩn ${ssdStd}` : ""} giúp máy khởi động nhanh và mở ứng dụng gần như tức thì.`,
            ssdMaxGb && `Bạn có thể nâng cấp ổ cứng tới ${formatCapacity(ssdMaxGb)} khi cần thêm chỗ chứa.`,
            ramMax && `Bộ nhớ RAM hỗ trợ nâng tới ${ramMax}.`,
          ),
        ],
      },
      {
        heading: "Thiết kế, pin và kết nối",
        paragraphs: [
          paragraph(
            weight && `Máy nặng khoảng ${weight}${dims ? `, kích thước ${dims}` : ""}.`,
            (battery || batteryWh) && `Pin ${batteryWh ?? battery} cho thời gian sử dụng ${gaming ? "đủ dùng khi làm việc, còn khi chơi game nên cắm sạc để có hiệu năng tối đa" : "thoải mái trong một buổi học hoặc ca làm việc"}.`,
            keyboard && `Đèn nền bàn phím: ${keyboard}.`,
            webcam && `Webcam ${webcam}.`,
            wifi && `Kết nối không dây ${noDot(wifi)}${bluetooth ? `, ${bluetooth}` : ""}.`,
            os && `Máy cài sẵn ${os}.`,
          ),
        ],
        bullets: ports ? [`Cổng kết nối: ${noDot(ports)}`] : undefined,
      },
    ],
    audience: gaming
      ? `${name} phù hợp với game thủ, sinh viên đồ họa – kiến trúc và người làm nội dung cần một chiếc laptop mạnh để chơi game, dựng hình và làm việc di động.${usage ? ` Nhu cầu phù hợp theo hãng: ${usage}.` : ""}`
      : `${name} phù hợp với sinh viên, giáo viên và nhân viên văn phòng cần một chiếc laptop bền bỉ, đủ nhanh cho công việc hằng ngày.${usage ? ` Nhu cầu phù hợp theo hãng: ${usage}.` : ""}`,
    specs: [
      ["CPU", cpu ? `${cpu}${cpuDetail ? ` (${cpuDetail})` : ""}` : undefined],
      ["Card đồ họa", gpuFull],
      ["RAM", ram ? `${ram}${ramType ? ` ${ramType}` : ""}${ramBus ? ` ${ramBus}` : ""}${ramMax ? ` (nâng cấp tối đa ${ramMax})` : ""}` : undefined],
      ["Ổ cứng", ssd ? `${ssd} SSD${ssdStd ? ` ${ssdStd}` : ""}` : undefined],
      ["Màn hình", size ? `${size}${res ? `, ${res}` : ""}${panel ? `, ${panel}` : ""}${hz ? `, ${hz}` : ""}` : undefined],
      ["Độ sáng / màu sắc", brightness || gamut ? compact([brightness, gamut]).join(", ") : undefined],
      ["Webcam", webcam],
      ["Bàn phím", keyboard],
      ["Cổng kết nối", ports],
      ["Kết nối không dây", wifi ? `${wifi}${bluetooth ? `, ${bluetooth}` : ""}` : undefined],
      ["Pin", batteryWh ?? battery],
      ["Trọng lượng", weight],
      ["Kích thước", dims],
      ["Hệ điều hành", os],
    ],
    chips: [cpuShortName, discrete ? gpuShortName : ram && `${tight(ram)} RAM`, discrete ? ram && `${tight(ram)}` : ssd && `SSD ${tight(ssd)}`],
    summary: [ram && `${tight(ram)}${ramType ? ` ${ramType}` : ""}`, ssd && `${tight(ssd)} SSD`, screen ? `Màn ${screen}` : undefined],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 24),
  };
}

export const laptopGaming = (ctx: Ctx) => laptop(ctx, true);
export const laptopOffice = (ctx: Ctx) => laptop(ctx, false);

/* -------------------------------------------------------------------------- */
/*  PC lắp ráp                                                                */
/* -------------------------------------------------------------------------- */

/** Số nhân/luồng của các CPU đã kiểm chứng; CPU ngoài danh sách thì bỏ qua con số, không đoán */
const KNOWN_CPUS: [RegExp, string][] = [
  [/i3-12100F?/i, "4 nhân 8 luồng"],
  [/i5-12400F?/i, "6 nhân 12 luồng"],
  [/i7-14700F?K?/i, "20 nhân 28 luồng"],
  [/Ultra 9 285K/i, "24 nhân 24 luồng"],
  [/Ultra 7 265(K|KF|F)?\b/i, "20 nhân 20 luồng"],
  [/Ryzen 7 7800X3D/i, "8 nhân 16 luồng"],
  [/Ryzen 7 9700X/i, "8 nhân 16 luồng"],
  [/Ryzen 9 9900X3D/i, "12 nhân 24 luồng"],
  [/Ryzen 9 9950X3D/i, "16 nhân 32 luồng"],
];

/** Phân khúc chơi game của card đồ hoạ theo tên; chỉ những dòng quen thuộc */
function gpuTier(gpu: string | undefined): { level: number; text: string } | undefined {
  if (!gpu) return undefined;
  if (/(5090|4090)/.test(gpu)) return { level: 5, text: "chơi mọi tựa game ở độ phân giải 4K với thiết lập cao, đồng thời dựng hình 3D, render và huấn luyện AI" };
  if (/(5080|4080|5070\s*Ti|4070\s*Ti)/i.test(gpu)) return { level: 4, text: "chơi game ở độ phân giải 2K đến 4K với thiết lập cao và xử lý tốt dựng phim, đồ họa 3D" };
  if (/(5070|4070|9070)/i.test(gpu)) return { level: 3, text: "chơi game ở độ phân giải 2K với thiết lập cao" };
  if (/(5060\s*Ti|4060\s*Ti|B580)/i.test(gpu)) return { level: 2, text: "chơi game Full HD với thiết lập cao và nhiều tựa game ở 2K" };
  if (/(5060|4060|3060|7600|B570)/i.test(gpu)) return { level: 2, text: "chơi game Full HD với thiết lập cao ở hầu hết các tựa game phổ biến" };
  return { level: 1, text: "chơi các tựa game eSports và game phổ thông ở Full HD với thiết lập phù hợp" };
}

/** "512 GB" → "512 GB"; nguồn đôi khi ghi "2 GB" cho ổ 2 TB, nên số quá nhỏ được hiểu là TB */
function pcStorage(value: string | undefined): string | undefined {
  const gb = toGigabytes(value);
  if (gb === undefined) return undefined;
  return formatCapacity(gb < 16 ? gb * 1000 : gb);
}

/** "RAM 16 GB" → "16 GB"; nguồn đôi khi ghi số nhỏ hơn thực tế nên chỉ dùng để hiển thị lại */
function pcRam(value: string | undefined): string | undefined {
  const gb = toGigabytes(value);
  return gb === undefined ? undefined : `${gb} GB`;
}

function pc(ctx: Ctx, workstation: boolean): Draft {
  const { item, name, a, seed } = ctx;
  // Tên máy là chuẩn, bảng thông số của nguồn đôi khi ghi sai CPU: xem pcParts
  const parts = pcParts(item);
  const cpu = parts.cpu?.replace(/\bprocessor\s+/i, "");
  // "RTX 5060Ti 8GB" → "RTX 5060 Ti 8GB": nguồn hay viết liền hậu tố
  const gpu = parts.gpu?.replace(/(\d)(Ti|XT)\b/i, "$1 $2");
  const mainboard = a.get(/^Mainboard$/)?.replace(/\s*\(([^)]*)\)/, " $1");
  const ram = pcRam(a.get(/^RAM$/));
  const ssd = pcStorage(a.get(/^SSD$/));
  const tier = gpuTier(gpu);
  const cpuCores = cpu ? KNOWN_CPUS.find(([pattern]) => pattern.test(cpu))?.[1] : undefined;
  const shortCpuName = cpu?.replace(/^(intel|amd)\s+/i, "").replace(/\bcore\s+i(\d)/i, "i$1").replace(/^I(\d)/, "i$1");
  const shortGpuName = gpu?.replace(/\s+\d+\s*GB$/i, "");
  const caption = "Ảnh minh họa cấu hình";

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là bộ PC do đội ngũ kỹ thuật PCZone lắp ráp sẵn, ${workstation ? "hướng tới công việc dựng hình, render và xử lý dữ liệu nặng" : "sẵn sàng cắm điện là chơi game"}.`,
      cpu && gpu ? `Máy dùng bộ vi xử lý ${cpu} kết hợp card đồ họa ${gpu}${ram ? `, ${ram} RAM` : ""}${ssd ? ` và ổ SSD ${ssd}` : ""}.` : cpu ? `Máy dùng bộ vi xử lý ${cpu}${ram ? `, ${ram} RAM` : ""}${ssd ? ` và ổ SSD ${ssd}` : ""}.` : undefined,
    ),
    paragraph(
      `Không muốn mất thời gian chọn từng linh kiện? ${name} là cấu hình được tính toán sẵn để các thành phần phối hợp ăn ý với nhau.`,
      cpu && `Trái tim là ${cpu}${gpu ? `, đi cùng ${gpu} để lo phần đồ họa` : ""}${ram ? `, ${ram} RAM` : ""}${ssd ? `, SSD ${ssd}` : ""}.`,
    ),
  ]);

  return {
    // CPU và card đồ họa đã có trong tên sản phẩm, ngoặc của tiêu đề chỉ bổ sung phần còn lại
    titleParts: [mainboard && `Mainboard ${mainboard}`, ram && `RAM ${tight(ram)}`, ssd && `SSD ${tight(ssd)}`],
    intro,
    imageCaption: caption,
    sections: [
      {
        heading: "Cấu hình chi tiết",
        paragraphs: ["Các thành phần chính của bộ máy:"],
        bullets: compact([
          cpu && `Bộ vi xử lý: ${cpu}${cpuCores ? ` (${cpuCores})` : ""}`,
          mainboard && `Bo mạch chủ: ${mainboard}`,
          ram && `Bộ nhớ RAM: ${ram}`,
          ssd && `Ổ cứng SSD: ${ssd}`,
          gpu && `Card đồ họa: ${gpu}`,
        ]),
      },
      {
        heading: workstation ? "Hiệu năng cho dựng hình và AI" : "Hiệu năng chơi game",
        paragraphs: [
          paragraph(
            cpu && `${cpu}${cpuCores ? ` với ${cpuCores}` : ""} đảm nhận xử lý chung, ${workstation ? "đủ sức chạy nhiều ứng dụng nặng cùng lúc như dựng phim, render và biên dịch" : "giữ khung hình ổn định khi chơi game, livestream và mở nhiều tab trình duyệt"}.`,
            gpu && tier && `Card đồ họa ${gpu} phù hợp để ${tier.text}.`,
            ram && `${ram} RAM giúp máy đa nhiệm thoải mái${workstation && (toGigabytes(ram) ?? 0) >= 64 ? ", đặc biệt với các dự án dùng nhiều bộ nhớ" : ""}.`,
            ssd && `Ổ SSD ${ssd} cho tốc độ khởi động và tải dữ liệu nhanh.`,
          ),
        ],
      },
      {
        heading: "Lắp ráp và kiểm tra tại PCZone",
        paragraphs: [
          "Mỗi bộ máy được kỹ thuật viên PCZone lắp ráp, đi dây gọn gàng và chạy thử ổn định trước khi giao đến tay bạn, nên bạn nhận về một chiếc máy sẵn sàng sử dụng. Linh kiện đều là hàng chính hãng, có hóa đơn và được bảo hành đầy đủ.",
          "Ảnh trong bài mô tả chỉ mang tính minh họa cho cấu hình; kiểu dáng vỏ case và một số linh kiện phụ có thể khác đôi chút theo lô hàng, thông số chính được giữ nguyên như bảng cấu hình.",
        ],
      },
      {
        heading: "Dễ nâng cấp về sau",
        paragraphs: [
          "Bộ PC được xây trên linh kiện tiêu chuẩn nên bạn có thể nâng cấp từng phần khi nhu cầu tăng: thêm RAM, gắn thêm SSD hoặc đổi card đồ họa mạnh hơn mà không phải thay cả bộ máy. Nhân viên PCZone luôn sẵn sàng tư vấn lộ trình nâng cấp phù hợp với ngân sách của bạn.",
        ],
      },
    ],
    audience: workstation
      ? `${name} phù hợp với người làm dựng phim, thiết kế 3D, kiến trúc, nghiên cứu dữ liệu và lập trình AI cần một cỗ máy mạnh, ổn định và sẵn sàng làm việc ngay.`
      : `${name} phù hợp với game thủ muốn có một bộ PC hoàn chỉnh, đã được kiểm tra kỹ, không phải tự lắp và cũng không lo tương thích linh kiện.`,
    specs: [
      ["Bộ vi xử lý (CPU)", cpu ? `${cpu}${cpuCores ? ` (${cpuCores})` : ""}` : undefined],
      ["Bo mạch chủ", mainboard],
      ["Bộ nhớ RAM", ram],
      ["Ổ cứng SSD", ssd],
      ["Card đồ họa (VGA)", gpu],
    ],
    chips: [shortCpuName, shortGpuName, ram && ssd ? `${tight(ram)} • ${tight(ssd)}` : ram && tight(ram)],
    summary: [ram && `${tight(ram)} RAM`, ssd && `${tight(ssd)} SSD`, mainboard && `Mainboard ${mainboard}`],
    warrantyMonths: 36,
  };
}

export const pcGaming = (ctx: Ctx) => pc(ctx, false);
export const pcWorkstation = (ctx: Ctx) => pc(ctx, true);

/* -------------------------------------------------------------------------- */
/*  Màn hình                                                                  */
/* -------------------------------------------------------------------------- */

export function monitor({ item, name, brand, a, seed }: Ctx): Draft {
  const size = a.get(/^Kích thước màn hình$/) ?? item.name.match(/(\d{2}(?:\.\d)?)"/)?.[1]?.concat(" inch");
  const sizeNum = firstNumber(size);
  const panel = a.get(/^Tấm nền$/);
  const res = a.get(/^Độ phân giải$/);
  const resShort = res?.match(/^(4K|2K|Full HD|QHD|UHD|WQHD)/i)?.[1] ?? item.name.match(/\b(4K|2K)\b/i)?.[1];
  const hzText = a.get(/^Tần số quét$/) ?? item.name.match(/(\d{2,3})\s*Hz/i)?.[0];
  const hz = firstNumber(hzText);
  const response = a.get(/^Thời gian phản hồi$/);
  const brightness = a.get(/^Độ sáng$/);
  const gamut = a.get(/^Không gian màu$/);
  const shape = a.get(/^Kiểu màn hình$/);
  const ports = a.get(/^Cổng kết nối$/);
  const vesa = a.get(/^Tương thích VESA$/);
  const flicker = a.flag(/^Khử nhấp nháy$/);
  const touch = a.flag(/^Màn hình cảm ứng$/);
  const usage = a.get(/^Nhu cầu sử dụng$/);
  const box = a.get(/^Phụ kiện trong hộp$/);
  const gaming = (usage !== undefined && /gaming/i.test(usage)) || (hz !== undefined && hz >= 144);
  const screen = compact([size?.replace(/\s*inch/i, '"'), resShort, panel, hz ? `${hz}Hz` : undefined]).join(" ");

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là màn hình${brand ? ` ${brand}` : ""} ${size ?? ""}${panel ? ` tấm nền ${panel}` : ""}${res ? `, độ phân giải ${res}` : ""}${hzText ? `, tần số quét ${hzText}` : ""}.`.replace(/\s+/g, " "),
      gaming ? "Màn hình hướng tới game thủ và người cần hình ảnh mượt, phản hồi nhanh cho cả chơi game lẫn công việc hằng ngày." : "Màn hình phù hợp cho làm việc, học tập và giải trí với hình ảnh rõ nét, dễ chịu cho mắt.",
    ),
    paragraph(
      `Màn hình là thứ bạn nhìn suốt cả ngày, nên một chiếc màn hình tốt tạo khác biệt lớn cho trải nghiệm. ${name} mang tới ${screen || "chất lượng hiển thị tốt"}${response ? ` và thời gian phản hồi ${response}` : ""}.`,
    ),
  ]);

  const clarity =
    sizeNum !== undefined && res
      ? /4K|UHD/i.test(res)
        ? `Ở kích thước ${size}, độ phân giải 4K cho mật độ điểm ảnh cao, chữ và hình ảnh cực kỳ sắc nét, rất hợp làm đồ họa, chỉnh ảnh và xem phim.`
        : /2K|QHD/i.test(res)
          ? `Độ phân giải 2K (QHD) trên màn hình ${size} là điểm cân bằng tốt giữa độ sắc nét và yêu cầu về card đồ họa, cho không gian làm việc rộng hơn Full HD.`
          : `Độ phân giải Full HD trên màn hình ${size} cho hình ảnh rõ nét, dễ chạy mượt ngay cả với cấu hình phổ thông.`
      : undefined;

  return {
    titleParts: [size, resShort, panel, hz ? `${hz}Hz` : undefined, response && `${response}`],
    intro,
    sections: [
      {
        heading: "Chất lượng hình ảnh",
        paragraphs: [
          paragraph(
            clarity,
            panel && `Tấm nền ${panel} ${/ips/i.test(panel) ? "cho góc nhìn rộng, màu sắc ổn định khi nhìn từ nhiều hướng" : /va/i.test(panel) ? "cho độ tương phản tốt, màu đen sâu hơn" : /tn/i.test(panel) ? "ưu tiên tốc độ phản hồi, phù hợp game eSports cạnh tranh" : /oled/i.test(panel) ? "tự phát sáng từng điểm ảnh, cho màu đen tuyệt đối và độ tương phản vượt trội" : "cho hình ảnh chất lượng ở phân khúc của mình"}.`,
            gamut && `Không gian màu: ${gamut}.`,
            brightness && `Độ sáng ${brightness}.`,
          ),
        ],
      },
      {
        heading: hz ? "Tần số quét và độ phản hồi" : "Độ phản hồi",
        paragraphs: [
          paragraph(
            hz && `Tần số quét ${hz}Hz nghĩa là hình ảnh được làm mới ${hz} lần mỗi giây, ${hz >= 120 ? "mượt hơn rõ rệt so với màn 60Hz phổ thông ở game hành động và cả khi cuộn trang, di chuột" : "đủ cho công việc và giải trí hằng ngày"}.`,
            hz && hz >= 120 && "Để tận dụng, cần card đồ họa đủ mạnh để tạo ra số khung hình tương ứng.",
            response && `Thời gian phản hồi ${response} giúp hạn chế vệt mờ khi hình ảnh chuyển động nhanh.`,
            flicker && "Màn hình có công nghệ khử nhấp nháy, giảm mỏi mắt khi làm việc nhiều giờ liền.",
          ),
        ],
      },
      {
        heading: "Cổng kết nối và tiện ích",
        paragraphs: [
          paragraph(
            ports && `Cổng kết nối gồm ${noDot(ports)}.`,
            ports && /type-?c|usb-?c/i.test(ports) && "Cổng USB-C cho phép truyền hình ảnh và cấp nguồn qua một sợi cáp duy nhất, rất gọn khi dùng với laptop.",
            touch === false && "Màn hình không cảm ứng.",
            touch && "Màn hình hỗ trợ cảm ứng.",
          ),
        ],
      },
      {
        heading: "Thiết kế và lắp đặt",
        paragraphs: [
          paragraph(
            shape && `Màn hình dạng ${shape.toLowerCase()}.`,
            vesa && `Chuẩn treo VESA ${vesa}, bạn có thể gắn giá treo hoặc tay đỡ để tiết kiệm diện tích bàn và điều chỉnh vị trí theo ý muốn.`,
            box && `Trong hộp có: ${noDot(box)}.`,
          ),
        ],
      },
    ],
    audience: gaming
      ? `${name} phù hợp với game thủ, người chơi eSports và những ai muốn một màn hình mượt, phản hồi nhanh${sizeNum !== undefined && sizeNum >= 27 ? ", kích thước đủ lớn để đắm chìm trong game" : ""}.`
      : `${name} phù hợp với người làm việc văn phòng, học tập và làm đồ họa cần một màn hình hiển thị rõ nét, dễ chịu cho mắt.`,
    specs: [
      ["Kích thước", size],
      ["Tấm nền", panel],
      ["Độ phân giải", res],
      ["Tần số quét", hzText],
      ["Thời gian phản hồi", response],
      ["Độ sáng", brightness],
      ["Không gian màu", gamut],
      ["Kiểu màn hình", shape],
      ["Cổng kết nối", ports],
      ["Chuẩn treo VESA", vesa],
      ["Khử nhấp nháy", flicker === undefined ? undefined : flicker ? "Có" : "Không"],
      ["Cảm ứng", touch === undefined ? undefined : touch ? "Có" : "Không"],
      ["Phụ kiện trong hộp", box],
    ],
    chips: [size?.replace(/\s*inch/i, '"'), panel, resShort, hz ? `${hz}Hz` : undefined],
    summary: [size, panel, resShort, hz ? `${hz}Hz` : undefined, response],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 24),
  };
}

/* -------------------------------------------------------------------------- */
/*  Bàn phím                                                                  */
/* -------------------------------------------------------------------------- */

export function keyboard({ name, brand, a, seed }: Ctx): Draft {
  const layout = a.get(/^Kích thước\/Layout$/);
  const type = a.get(/^Loại bàn phím$/);
  const switchKind = a.get(/^Kiểu Switch$/);
  const switchName = a.get(/^Tên Switch$/);
  const connection = a.get(/^Phương thức kết nối$/);
  const material = a.get(/^Chất liệu vỏ$/);
  const os = a.get(/^Hệ điều hành tương thích$/);
  const software = a.get(/^Phần mềm hỗ trợ$/);
  const led = a.get(/^Đèn LED$/);
  const keycap = a.get(/^Màu sắc phím$/);
  const usage = a.get(/^Mục đích sử dụng$/);
  const line = a.get(/^Dòng sản phẩm \(Collection\)$/);
  // Một số sản phẩm điền "Loại Switch thuộc thương hiệu" thay cho kiểu switch thật: bỏ qua
  const kind = switchKind && !/thuộc thương hiệu/i.test(switchKind) ? switchKind : undefined;
  const wireless = connection !== undefined && /bluetooth|wireless|2\.4/i.test(connection);
  const magnetic = type !== undefined && /hall|từ tính/i.test(type + (switchName ?? ""));

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là bàn phím${type ? ` ${lower(type)}` : ""}${brand ? ` của ${brand}` : ""}${layout ? ` layout ${layout}` : ""}${switchName ? `, dùng switch ${switchName}` : ""}.`,
      wireless ? "Bàn phím hỗ trợ kết nối không dây nên bàn làm việc gọn gàng, dễ chuyển giữa nhiều thiết bị." : "Bàn phím kết nối có dây cho độ trễ thấp và không phải lo chuyện pin.",
    ),
    paragraph(
      `Bàn phím là thiết bị chạm vào nhiều nhất mỗi ngày, vì vậy cảm giác gõ đáng để bạn đầu tư. ${name} mang tới ${switchName ? `switch ${switchName}` : "trải nghiệm gõ tốt"}${layout ? ` trên layout ${layout}` : ""}${led ? ` cùng đèn nền ${led}` : ""}.`,
    ),
  ]);

  return {
    titleParts: [layout && `Layout ${layout}`, switchName, connection && firstPart(connection)?.split(/,\s*/)[0], led],
    intro,
    sections: [
      {
        heading: "Trải nghiệm gõ và switch",
        paragraphs: [
          paragraph(
            switchName && `Bàn phím dùng switch ${switchName}${kind ? ` (${kind})` : ""}.`,
            magnetic ? "Công nghệ từ tính (Hall Effect) đo độ sâu nhấn liên tục nên cho phép tùy chỉnh điểm kích hoạt từng phím và bật tính năng Rapid Trigger để phản hồi cực nhanh trong game FPS." : kind && /linear/i.test(kind) ? "Switch dạng Linear cho hành trình phím êm, mượt và đều, phù hợp game và gõ nhanh." : undefined,
            type && /cơ/i.test(type) && "Bàn phím cơ cho cảm giác nhấn rõ ràng, độ bền cao và có thể thay switch hoặc keycap để cá nhân hóa.",
          ),
        ],
      },
      {
        heading: "Layout và thiết kế",
        paragraphs: [
          paragraph(
            layout && `Layout ${layout}${/^\d+%$/.test(layout) ? " giúp tiết kiệm diện tích bàn mà vẫn giữ những phím cần thiết" : ""}.`,
            material && `Vỏ bàn phím làm từ ${lower(material)}${/kim loại/i.test(material) ? ", chắc chắn và có cảm giác cao cấp" : ""}.`,
            keycap && `Màu sắc keycap: ${keycap}.`,
          ),
        ],
      },
      {
        heading: "Kết nối và tương thích",
        paragraphs: [
          paragraph(
            connection && `Phương thức kết nối: ${noDot(connection)}.`,
            os && `Hệ điều hành tương thích: ${noDot(os)}.`,
            wireless && "Khi dùng không dây, bạn nên sạc pin đầy trước khi mang đi làm việc và ưu tiên chế độ 2.4GHz khi chơi game để có độ trễ thấp nhất (nếu bàn phím hỗ trợ).",
          ),
        ],
      },
      {
        heading: "Phần mềm và đèn LED",
        paragraphs: [
          paragraph(
            led && `Hệ thống đèn nền ${led} giúp bạn nhìn rõ phím trong phòng tối và tạo điểm nhấn cho góc làm việc.`,
            software && `Phần mềm hỗ trợ: ${noDot(software)}; cho phép gán lại phím, tạo macro và chỉnh hiệu ứng đèn theo ý thích.`,
          ),
        ],
      },
    ],
    audience: `${name} phù hợp với ${usage ? lower(noDot(usage)).replace(/,\s*/g, ", ") : "game thủ và người làm việc văn phòng"} — những ai coi trọng cảm giác gõ và muốn một bàn phím bền, đẹp trên bàn làm việc.`,
    specs: [
      ["Loại bàn phím", type],
      ["Layout", layout],
      ["Switch", switchName ? `${switchName}${kind ? ` (${kind})` : ""}` : kind],
      ["Kết nối", connection],
      ["Chất liệu vỏ", material],
      ["Đèn LED", led],
      ["Màu keycap", keycap],
      ["Hệ điều hành tương thích", os],
      ["Phần mềm hỗ trợ", software],
      ["Mục đích sử dụng", usage],
    ],
    // 3 chip đầu ngắn cho thẻ sản phẩm; tên switch và kiểu switch dài nên đứng sau, chỉ hiện ở trang chi tiết
    chips: [
      layout,
      magnetic ? "Hall Effect" : type && /cơ/i.test(type) ? "Bàn phím cơ" : type,
      wireless ? "Không dây" : "Có dây",
      kind && `Switch ${lower(kind)}`,
      switchName && `Switch ${switchName}`,
    ],
    summary: [layout && `Layout ${layout}`, switchName, connection && firstPart(connection)?.split(/,\s*/)[0], led],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}

/* -------------------------------------------------------------------------- */
/*  Chuột                                                                     */
/* -------------------------------------------------------------------------- */

export function mouse({ name, brand, a, seed }: Ctx): Draft {
  const sensor = a.get(/^Cảm biến \(Sensor\)$/);
  const dpi = a.get(/^Độ phân giải \(DPI\)$/);
  const buttons = a.get(/^Số nút bấm$/);
  const weight = a.get(/^Trọng lượng$/);
  const size = a.get(/^Kích thước$/);
  const batteryLife = a.get(/^Thời lượng pin$/);
  const batteryType = a.get(/^Loại pin$/);
  const connection = a.get(/^Kết nối$/);
  const polling = a.get(/^Polling Rate$/);
  const switches = a.get(/^Loại switch$/);
  const switchLife = a.get(/^Độ bền switch$/);
  const software = a.get(/^Phần mềm hỗ trợ$/);
  const led = a.get(/^Đèn LED$/);
  const form = a.get(/^Kiểu dáng \(Form\)$/);
  const special = a.get(/^Tính năng đặc biệt$/);
  const charge = a.get(/^Cổng sạc$/);
  const accessories = a.get(/^Phụ kiện đi kèm$/);
  const weightNum = firstNumber(weight);
  const wireless = connection !== undefined && /không dây|bluetooth|đa kết nối|wireless/i.test(connection);
  const light = weightNum !== undefined && weightNum <= 70;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là chuột${brand ? ` của ${brand}` : ""}${wireless ? " không dây" : ""}${sensor ? ` trang bị cảm biến ${sensor}` : ""}${dpi ? `, độ phân giải ${dpi}` : ""}${weight ? `, trọng lượng ${weight}` : ""}.`,
      light ? "Thiết kế siêu nhẹ giúp di chuột nhanh và ít mỏi tay, rất hợp game bắn súng góc nhìn thứ nhất." : "Chuột hướng tới trải nghiệm thoải mái khi dùng nhiều giờ liền, cho cả làm việc và chơi game.",
    ),
    paragraph(
      `Con chuột tốt giúp thao tác chính xác hơn và đỡ mỏi tay hơn. ${name} kết hợp ${sensor ? `cảm biến ${sensor}` : "cảm biến chính xác"}${polling ? `, polling rate ${polling}` : ""} và ${weight ? `trọng lượng ${weight}` : "thiết kế công thái học"}.`,
    ),
  ]);

  return {
    titleParts: [sensor, dpi, weight, connection && firstPart(connection)?.split(/,\s*/)[0]],
    intro,
    sections: [
      {
        heading: "Cảm biến và độ chính xác",
        paragraphs: [
          paragraph(
            sensor && `Cảm biến ${sensor} theo dõi chuyển động chính xác${dpi ? `, độ phân giải ${dpi} để bạn tùy chỉnh độ nhạy từ chậm và chính xác đến nhanh và bao quát` : ""}.`,
            polling && `Tần số quét (polling rate) ${polling}: con số càng cao thì chuột báo vị trí về máy tính càng thường xuyên, cho phản hồi mượt hơn.`,
          ),
        ],
      },
      {
        heading: "Kết nối và thời lượng pin",
        paragraphs: [
          paragraph(
            connection && `Phương thức kết nối: ${noDot(connection)}.`,
            batteryLife && `Thời lượng pin khoảng ${batteryLife}${batteryType ? ` (${lower(batteryType)})` : ""}.`,
            charge && `Sạc qua cổng ${charge}.`,
            !wireless && "Chuột kết nối có dây nên không phải lo pin và có độ trễ ổn định.",
          ),
        ],
      },
      {
        heading: "Thiết kế và cảm giác cầm",
        paragraphs: [
          paragraph(
            weight && `Chuột nặng ${weight}${light ? ", thuộc nhóm siêu nhẹ" : ""}${size ? `, kích thước ${size}` : ""}.`,
            form && `Kiểu dáng ${lower(form)}.`,
            buttons && `${buttons} bấm được, đủ cho thao tác hằng ngày và gán phím tắt khi chơi game.`,
            led && `Đèn LED ${led}.`,
          ),
        ],
      },
      {
        heading: "Switch và phần mềm",
        paragraphs: [
          paragraph(
            switches && `Nút chính dùng ${switches}${switchLife ? `, độ bền công bố ${switchLife}` : ""}.`,
            software && `Phần mềm hỗ trợ: ${noDot(software)}, cho phép chỉnh DPI, gán nút, tạo macro và lưu cấu hình.`,
            special && `Điểm nhấn khác: ${noDot(special)}.`,
          ),
        ],
        bullets: accessories ? [`Trong hộp: ${noDot(accessories)}`] : undefined,
      },
    ],
    audience: light
      ? `${name} phù hợp với game thủ FPS, người chơi eSports và những ai thích chuột nhẹ, phản hồi nhanh.`
      : `${name} phù hợp với người dùng cần một con chuột chính xác, bền và thoải mái cho cả làm việc lẫn giải trí.`,
    specs: [
      ["Cảm biến", sensor],
      ["Độ phân giải (DPI)", dpi],
      ["Tần số quét", polling],
      ["Kết nối", connection],
      ["Số nút", buttons],
      ["Trọng lượng", weight],
      ["Kích thước", size],
      ["Kiểu dáng", form],
      ["Switch", switches],
      ["Thời lượng pin", batteryLife],
      ["Cổng sạc", charge],
      ["Đèn LED", led],
      ["Phần mềm", software],
    ],
    // Tên cảm biến đầy đủ ("Razer Focus Pro 45K Optical Sensor Gen-2") quá dài cho chip: rút gọn, bản đầy đủ đứng sau
    chips: [
      sensor?.replace(/^razer\s+/i, "").replace(/\s*(optical\s+)?sensor.*$/i, ""),
      dpi,
      weight && tight(weight),
      sensor && /sensor/i.test(sensor) ? `Cảm biến ${sensor}` : undefined,
    ],
    summary: [sensor, dpi, weight, connection && firstPart(connection)?.split(/,\s*/)[0]],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}
