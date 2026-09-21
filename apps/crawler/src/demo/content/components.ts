/**
 * Nội dung cho nhóm linh kiện: CPU, mainboard, RAM, card đồ hoạ, SSD, nguồn, vỏ case.
 * Mỗi hàm nhận thông số của một sản phẩm và trả về `Draft` (xem common.ts).
 */
import { firstNumber, formatCapacity, toGigabytes } from "../attributes.js";
import { pickVariant } from "../names.js";
import {
  compact,
  listVi,
  midSentence,
  noDot,
  paragraph,
  warrantyMonths,
  type Ctx,
  type Draft,
} from "./common.js";

/** "4.2 GHz" → "4.2GHz"; "6000 MHz" → "6000MHz": dạng gọn cho chip trên thẻ sản phẩm */
const tight = (value: string | undefined) => value?.replace(/\s+/g, "");

/** 36.000 → "36.000", cho tốc độ MB/s dễ đọc */
const thousands = (value: number) => value.toLocaleString("vi-VN");

/* -------------------------------------------------------------------------- */
/*  CPU                                                                       */
/* -------------------------------------------------------------------------- */

export function cpu({ item, name, brand, a, seed }: Ctx): Draft {
  const cores = firstNumber(a.get(/^Số nhân$/));
  const threads = firstNumber(a.get(/^Số luồng$/));
  const pCores = firstNumber(a.get(/^Số nhân P-core$/));
  const eCores = firstNumber(a.get(/^Số nhân E-core$/));
  const base = a.get(/^Xung nhịp cơ bản P-core/, /^Xung nhịp cơ bản/);
  const boost = a.get(/^Xung nhịp tối đa P-core/, /^Xung nhịp tối đa/);
  const socket = a.get(/^Socket$/);
  const arch = a.get(/^Kiến trúc$/);
  const line = a.get(/^Dòng CPU$/);
  const tdp = a.get(/^TDP \(Điện năng tiêu thụ\)$/, /^TDP$/);
  const tdpMax = a.get(/^TDP Max/);
  const ramType = a.get(/^Hỗ trợ loại RAM$/);
  const ramSpeed = a.get(/^Tốc độ RAM tối đa$/);
  const channels = a.get(/^Số kênh RAM$/);
  const pcieGen = a.get(/^Hỗ trợ PCIe$/)?.match(/\d/)?.[0];
  const hasIgpu = a.flag(/^Đồ họa tích hợp$/);
  const igpu = a.get(/^Chip đồ họa tích hợp$/);

  // Tên nguồn ghi tổng bộ nhớ đệm: "… / 38MB / AM5". AMD tính gộp L2 + L3, Intel ghi L3 (Smart Cache)
  const cacheMb = item.name.match(/\/\s*(\d+)\s*MB\s*\//i)?.[1];
  const cache = cacheMb ? `${cacheMb} MB ${brand === "AMD" ? "(tổng L2 + L3)" : "(L3 – Intel Smart Cache)"}` : undefined;

  const isTray = /\btray\b/i.test(item.name);
  const hybrid = pCores !== undefined && eCores !== undefined;
  const platform = ramType && socket ? `${socket} • ${ramType}` : socket;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là bộ vi xử lý ${brand ?? ""} dành cho máy tính để bàn`.replace("  ", " ") + (line ? `, thuộc dòng ${line}` : "") + (arch ? ` trên kiến trúc ${arch}.` : "."),
      cores && threads && `Chip có ${cores} nhân ${threads} luồng${boost ? `, xung nhịp tối đa ${boost}` : ""}${socket ? ` và dùng socket ${socket}` : ""}, đủ cho từ chơi game, làm việc đa nhiệm đến sáng tạo nội dung.`,
    ),
    paragraph(
      `Nếu bạn đang lên cấu hình mới, ${name} là một lựa chọn đáng cân nhắc${line ? ` trong dòng ${line}` : ""}.`,
      cores && threads && `Bộ vi xử lý này mang ${cores} nhân ${threads} luồng${boost ? `, có thể tăng xung tới ${boost}` : ""}${arch ? `, xây dựng trên kiến trúc ${arch}` : ""}.`,
      socket && `Chip lắp vào bo mạch chủ socket ${socket}, nên khi chọn linh kiện đi kèm bạn chỉ cần chú ý đúng nền tảng.`,
    ),
    paragraph(
      `${name} thuộc nhóm CPU ${brand ?? "chính hãng"} dành cho PC${line ? `, dòng ${line}` : ""}.`,
      cores && threads && `Với ${cores} nhân ${threads} luồng${base && boost ? `, xung nhịp từ ${base} lên tới ${boost}` : ""}, chip giữ được sự cân bằng giữa hiệu năng, mức điện năng và chi phí nâng cấp về sau.`,
    ),
  ]);

  return {
    titleParts: [
      boost && `xung nhịp tối đa ${tight(boost)}`,
      cores && threads ? `${cores} nhân ${threads} luồng` : undefined,
      cacheMb ? `${cacheMb}MB Cache` : undefined,
      tdp && tight(tdp),
      socket && `Socket ${socket}`,
    ],
    intro,
    sections: [
      {
        heading: "Hiệu năng xử lý đa nhân",
        paragraphs: [
          paragraph(
            cores && threads && `${name} có ${cores} nhân ${threads} luồng${hybrid ? `, gồm ${pCores} nhân hiệu năng cao (P-core) và ${eCores} nhân tiết kiệm điện (E-core)` : ""}.`,
            hybrid && "Các P-core đảm nhận tác vụ cần phản hồi nhanh như chơi game, còn E-core gánh việc nền và tác vụ nhiều luồng, giúp máy vừa mạnh vừa đỡ tốn điện.",
            !hybrid && cores !== undefined && threads !== undefined && threads > cores && "Công nghệ đa luồng cho phép mỗi nhân xử lý hai luồng cùng lúc, giữ máy mượt khi bạn vừa chơi game, vừa mở trình duyệt, phát trực tiếp và chạy các ứng dụng nền.",
            !hybrid && cores !== undefined && threads !== undefined && threads === cores && "Mỗi nhân xử lý một luồng, dồn sức mạnh cho những tác vụ cần phản hồi nhanh như chơi game, lập trình hay thiết kế.",
          ),
          paragraph(
            base && boost && `Xung nhịp cơ bản ${base}, tự động tăng tới ${boost} khi cần hiệu năng cao.`,
            cache && `Bộ nhớ đệm ${cache} giúp CPU truy xuất dữ liệu nhanh hơn, giảm thời gian chờ ở các tác vụ nặng.`,
            /x3d/i.test(item.name) && "Hậu tố X3D nghĩa là chip dùng công nghệ AMD 3D V-Cache, xếp chồng thêm bộ nhớ đệm L3 lên trên nhân xử lý; dung lượng đệm lớn giúp tăng số khung hình ở nhiều tựa game.",
          ),
        ],
      },
      {
        heading: socket ? `Nền tảng ${socket} và khả năng nâng cấp` : "Nền tảng và khả năng nâng cấp",
        paragraphs: [
          paragraph(
            socket && `Chip dùng socket ${socket}${ramType ? `, hỗ trợ RAM ${ramType}${ramSpeed ? ` tốc độ tới ${ramSpeed}` : ""}${channels ? ` chạy ${channels}` : ""}` : ""}${pcieGen ? ` và chuẩn PCIe ${pcieGen}.0` : ""}.`,
            "Khi ghép máy, bạn cần chọn bo mạch chủ đúng socket và đúng đời chipset tương thích; với một số bo mạch đời cũ có thể phải cập nhật BIOS trước khi dùng CPU mới. Kỹ thuật viên PCZone sẵn sàng kiểm tra tương thích giúp bạn trước khi đặt hàng.",
          ),
        ],
        bullets: compact([
          socket && `Socket: ${socket}`,
          ramType && `Bộ nhớ hỗ trợ: ${ramType}${ramSpeed ? `, tối đa ${ramSpeed}` : ""}`,
          pcieGen && `Chuẩn PCIe: ${pcieGen}.0`,
        ]),
      },
      hasIgpu === undefined
        ? { heading: "Đồ họa" }
        : {
            heading: hasIgpu ? "Có sẵn đồ họa tích hợp" : "Cần card đồ họa rời",
            paragraphs: [
              hasIgpu
                ? `${name} có sẵn nhân đồ họa tích hợp${igpu && !/^không/i.test(igpu) ? ` (${igpu})` : ""}, đủ để xuất hình, xem phim và làm việc văn phòng khi bạn chưa lắp card đồ họa rời. Khi cần chơi game nặng, bạn vẫn có thể bổ sung card rời bất cứ lúc nào.`
                : `${name} không có nhân đồ họa tích hợp, vì vậy bạn cần lắp card đồ họa rời (VGA) thì máy mới xuất được hình. Đổi lại, phần diện tích và điện năng dành cho đồ họa được nhường cho các nhân xử lý, và bạn tự do chọn card đồ họa phù hợp túi tiền.`,
            ],
          },
      {
        heading: "Điện năng và tản nhiệt",
        paragraphs: [
          paragraph(
            tdp && `Mức điện năng tiêu thụ cơ bản (TDP) là ${tdp}${tdpMax ? `, có thể lên tới ${tdpMax} khi tăng tốc tối đa` : ""}.`,
            isTray
              ? "Đây là phiên bản Tray: chỉ gồm bộ vi xử lý, không kèm hộp đựng và tản nhiệt đi theo, nên bạn cần mua thêm tản nhiệt khí hoặc tản nhiệt nước phù hợp."
              : "Bạn nên chọn tản nhiệt tương xứng với mức TDP để chip giữ được xung nhịp cao trong thời gian dài, đồng thời chọn nguồn có công suất dư để hệ thống vận hành ổn định.",
          ),
        ],
      },
    ],
    audience:
      threads !== undefined && threads >= 20
        ? `${name} phù hợp với người dựng video, render 3D, biên dịch mã nguồn lớn, hoặc streamer vừa chơi game vừa phát trực tiếp — những công việc tận dụng được nhiều nhân.`
        : threads !== undefined && threads >= 12
          ? `${name} phù hợp với game thủ muốn khung hình cao, sinh viên thiết kế đồ họa và người làm việc đa nhiệm cần một bộ xử lý mạnh nhưng vẫn hợp lý về chi phí.`
          : `${name} phù hợp với máy văn phòng, học tập, giải trí và chơi game eSports ở mức phổ thông với chi phí dễ tiếp cận.`,
    specs: [
      ["Socket", socket],
      ["Số nhân / luồng", cores && threads ? `${cores} nhân / ${threads} luồng${hybrid ? ` (${pCores} P-core + ${eCores} E-core)` : ""}` : undefined],
      ["Xung nhịp", base && boost ? `Cơ bản ${base}, tối đa ${boost}` : boost],
      ["Bộ nhớ đệm", cache],
      ["TDP", tdp ? `${tdp}${tdpMax ? ` (tối đa ${tdpMax})` : ""}` : undefined],
      ["Kiến trúc", arch],
      ["Đồ họa tích hợp", hasIgpu === false ? "Không có (cần card đồ họa rời)" : hasIgpu ? igpu ?? "Có" : undefined],
      ["Bộ nhớ hỗ trợ", ramType ? `${ramType}${ramSpeed ? `, tối đa ${ramSpeed}` : ""}${channels ? `, ${channels}` : ""}` : undefined],
      ["PCIe", pcieGen ? `PCIe ${pcieGen}.0` : undefined],
      ["Hình thức", isTray ? "Tray (không kèm tản nhiệt)" : undefined],
    ],
    chips: [
      cores && threads ? `${cores}C/${threads}T` : undefined,
      boost && `Up ${tight(boost)}`,
      socket,
      platform && `Nền tảng ${platform}`,
    ],
    summary: [socket && `Socket ${socket}`, tdp && `TDP ${tight(tdp)}`, ramType, pcieGen && `PCIe ${pcieGen}.0`],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 36),
  };
}

/* -------------------------------------------------------------------------- */
/*  Mainboard                                                                 */
/* -------------------------------------------------------------------------- */

export function mainboard({ name, brand, a, seed }: Ctx): Draft {
  const chipset = a.get(/^Chipset$/);
  const chip = chipset?.replace(/^(intel|amd)\s+/i, "");
  const socket = a.get(/^Socket$/);
  const form = a.get(/^Kích thước$/)?.replace(/^micro\s*atx$/i, "Micro-ATX");
  const ramType = a.get(/^Kiểu RAM hỗ trợ$/);
  const ramSlots = a.get(/^Khe RAM tối đa$/);
  const ramMax = a.get(/^Dung lượng RAM tối đa$/);
  const m2 = a.get(/^Số khe M\.2$/);
  const sata = a.get(/^Số cổng SATA$/);
  const pcie = a.get(/^PCIe Gen$/);
  const vrm = a.get(/^VRM pha$/);
  const lan = a.get(/^Kết nối mạng LAN$/);
  const wifi = a.get(/^Wi-Fi$/);
  const bluetooth = a.get(/^Bluetooth$/);
  const usb = a.get(/^Cổng USB$/);
  const usbC = a.flag(/^Cổng USB Type-C$/);
  const video = a.get(/^Cổng xuất hình$/);
  const cpuSupport = a.get(/^CPU hỗ trợ$/);
  const rgb = a.flag(/^RGB LED$/);
  const hasWifi = wifi !== undefined && !/^không/i.test(wifi);
  const large = form !== undefined && /^(e-?atx|atx)$/i.test(form);

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là bo mạch chủ${brand ? ` của ${brand}` : ""} dùng chipset ${chipset ?? "hiện đại"}${socket ? `, socket ${socket}` : ""}${form ? `, chuẩn ${form}` : ""}.`,
      ramType && `Bo mạch hỗ trợ RAM ${ramType}${ramSlots ? ` với ${ramSlots}` : ""}${m2 ? ` cùng ${m2} M.2 cho SSD NVMe` : ""}, là nền tảng vững chắc để lắp một bộ PC ${large ? "cấu hình cao" : "gọn gàng, tiết kiệm"}.`,
    ),
    paragraph(
      `Bo mạch chủ là "xương sống" của cả hệ thống, và ${midSentence(name)} được thiết kế để làm tốt việc đó ở phân khúc của mình.`,
      chipset && socket && `Với chipset ${chipset} trên socket ${socket}, bo mạch cho phép bạn ghép CPU đúng đời, gắn ${ramType ?? "RAM"} và các ổ lưu trữ hiện đại mà không phải đắn đo về khả năng tương thích.`,
    ),
  ]);

  return {
    titleParts: [chip && `Chipset ${chip}`, socket && `Socket ${socket}`, ramType, form, hasWifi ? wifi : undefined],
    intro,
    sections: [
      {
        heading: chip ? `Chipset ${chip} và socket ${socket ?? ""}`.trim() : "Nền tảng và chipset",
        paragraphs: [
          paragraph(
            chipset && socket && `Chipset ${chipset} đi cùng socket ${socket}, quyết định dòng CPU nào lắp được và bo mạch có những tính năng gì.`,
            cpuSupport && `Theo thông tin nhà sản xuất, bo mạch hỗ trợ: ${noDot(cpuSupport)}.`,
            "Một số CPU đời mới có thể cần cập nhật BIOS mới nhất trước khi chạy; hãy hỏi PCZone để được kiểm tra tương thích trước khi mua.",
          ),
        ],
      },
      {
        heading: "Bộ nhớ và lưu trữ",
        paragraphs: [
          paragraph(
            ramType && `Bo mạch dùng RAM ${ramType}${ramSlots ? `, có ${ramSlots}` : ""}${ramMax ? ` và hỗ trợ tối đa ${ramMax}` : ""}. Lưu ý DDR4 và DDR5 không cắm lẫn được, nên hãy chọn RAM đúng chuẩn của bo mạch.`,
            m2 && `Bạn có ${m2} M.2 cho SSD NVMe${pcie ? ` (${pcie})` : ""}${sata ? ` và ${sata} SATA cho ổ 2.5" hoặc HDD` : ""}, đủ chỗ để mở rộng dung lượng theo nhu cầu.`,
          ),
        ],
      },
      {
        heading: "Kết nối mạng và cổng giao tiếp",
        paragraphs: [
          paragraph(
            lan && `Cổng mạng có dây tốc độ ${lan}.`,
            hasWifi ? `Bo mạch tích hợp ${wifi}${bluetooth && !/^(không|có)$/i.test(bluetooth) ? ` và ${bluetooth}` : bluetooth && /^có$/i.test(bluetooth) ? " kèm Bluetooth" : ""}, giúp kết nối không dây ổn định mà không cần mua thêm card.` : wifi ? "Bo mạch không tích hợp Wi-Fi; nếu cần kết nối không dây bạn có thể bổ sung card Wi-Fi qua khe PCIe hoặc USB." : undefined,
            usb && `Mặt sau và các đầu cắm trên bo mạch cung cấp tổng cộng ${usb} USB${usbC ? ", trong đó có USB Type-C" : ""}.`,
            video && `Cổng xuất hình tích hợp: ${noDot(video)} (dùng khi CPU có đồ họa tích hợp).`,
          ),
        ],
      },
      {
        heading: "Cấp nguồn và đèn LED",
        paragraphs: [
          paragraph(
            vrm && `Hệ thống cấp nguồn VRM ${vrm} giúp CPU nhận điện ổn định khi chạy tải nặng; số pha nhiều và tản nhiệt tốt thường cho khả năng giữ xung nhịp bền hơn khi làm việc lâu.`,
            rgb && "Bo mạch có LED RGB để bạn tạo điểm nhấn ánh sáng cho bộ máy.",
            rgb === false && "Bo mạch không có đèn LED, phù hợp bộ máy tối giản và tiết kiệm điện.",
          ),
        ],
      },
    ],
    audience: large
      ? `${name} phù hợp với người lắp cấu hình mạnh cần nhiều khe cắm mở rộng, nhiều ổ M.2 và khả năng nâng cấp lâu dài: game thủ, người làm đồ họa và dựng phim.`
      : `${name} phù hợp với người lắp PC học tập, văn phòng hoặc gaming ngân sách vừa phải, cần một bo mạch gọn, ổn định và dễ lắp vào các loại case nhỏ.`,
    specs: [
      ["Chipset", chipset],
      ["Socket", socket],
      ["Kích thước (form factor)", form],
      ["CPU hỗ trợ", cpuSupport],
      ["Bộ nhớ", ramType ? `${ramType}${ramSlots ? `, ${ramSlots}` : ""}${ramMax ? `, tối đa ${ramMax}` : ""}` : undefined],
      ["Khe M.2", m2],
      ["Cổng SATA", sata],
      ["PCIe", pcie],
      ["Cấp nguồn (VRM)", vrm],
      ["Mạng LAN", lan],
      ["Wi-Fi", wifi],
      ["Bluetooth", bluetooth],
      ["Cổng USB", usb],
      ["Cổng xuất hình", video],
      ["LED RGB", rgb === undefined ? undefined : rgb ? "Có" : "Không"],
    ],
    chips: [chip, socket, ramType, form],
    summary: [socket && `Socket ${socket}`, ramType, form, hasWifi ? wifi : undefined, m2 && `${m2} M.2`],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 36),
  };
}

/* -------------------------------------------------------------------------- */
/*  RAM                                                                       */
/* -------------------------------------------------------------------------- */

export function ram({ item, name, brand, a, seed }: Ctx): Draft {
  const type = a.get(/^Loại RAM$/) ?? item.name.match(/DDR[345]/i)?.[0].toUpperCase();
  const bus = a.get(/^Bus RAM$/);
  const cas = a.get(/^CAS Latency$/);
  const voltage = a.get(/^Điện áp$/);
  const line = a.get(/^Dòng sản phẩm$/);

  // "1x16GB", "96GB (2x48GB)": tên nguồn ghi rõ số thanh và dung lượng mỗi thanh
  const kitMatch = item.name.match(/(\d+)\s*x\s*(\d+)\s*GB/i);
  const modules = kitMatch ? Number(kitMatch[1]) : firstNumber(a.get(/^Số lượng thanh$/));
  const perModule = kitMatch ? Number(kitMatch[2]) : undefined;
  const total = toGigabytes(a.get(/^Dung lượng RAM$/)) ?? (kitMatch ? Number(kitMatch[1]) * Number(kitMatch[2]) : toGigabytes(item.name));
  const kit = total ? (modules && modules > 1 && perModule ? `${total} GB (${modules} x ${perModule} GB)` : `${total} GB`) : undefined;

  const xmp = a.flag(/^Intel XMP$/);
  const expo = /^có/i.test(a.get(/^AMD EXPO$/) ?? "");
  const rgb = a.flag(/^RGB\/LED$/, /^RGB$/);
  const heatspreader = a.flag(/^Tản nhiệt$/);
  const dual = modules !== undefined && modules >= 2;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là bộ nhớ RAM${brand ? ` của ${brand}` : ""} chuẩn ${type ?? "desktop"} dành cho máy tính để bàn${line ? `, thuộc dòng ${line}` : ""}.`,
      kit && bus && `Bộ ${kit} có tốc độ ${bus}${cas ? `, độ trễ ${cas}` : ""}, đáp ứng tốt nhu cầu từ làm việc, chơi game đến sáng tạo nội dung.`,
    ),
    paragraph(
      `Muốn máy mượt hơn khi đa nhiệm, nâng cấp RAM luôn là bước đầu tư dễ thấy hiệu quả nhất. ${name} mang tới ${kit ?? "dung lượng lớn"}${type ? ` ${type}` : ""}${bus ? ` chạy ở ${bus}` : ""}${cas ? `, ${cas}` : ""}.`,
    ),
  ]);

  const capacityText =
    total === undefined
      ? undefined
      : total <= 8
        ? `Dung lượng ${kit} đủ cho công việc văn phòng, học tập và các tựa game nhẹ; nếu chơi game hiện đại hoặc mở nhiều ứng dụng cùng lúc, bạn nên cân nhắc nâng lên 16 GB trở lên.`
        : total <= 16
          ? `Dung lượng ${kit} là mức phổ biến cho máy chơi game và làm việc hằng ngày: chạy mượt game hiện đại kèm trình duyệt và ứng dụng chat mở song song.`
          : total <= 32
            ? `Dung lượng ${kit} thoải mái cho game thủ vừa chơi vừa phát trực tiếp, cũng như người dựng video, thiết kế đồ họa và chạy máy ảo.`
            : `Dung lượng ${kit} dành cho công việc nặng như dựng phim 4K, render 3D, chạy nhiều máy ảo hoặc xử lý dữ liệu lớn, nơi RAM luôn là điểm nghẽn.`;

  return {
    titleParts: [kit, type, bus && `Bus ${tight(bus)}`, cas],
    intro,
    sections: [
      {
        heading: kit ? `Dung lượng ${kit}` : "Dung lượng",
        paragraphs: [
          paragraph(capacityText, dual && `Kit ${modules} thanh chạy chế độ Dual Channel (kênh đôi) khi cắm đúng khe, nhân đôi băng thông so với một thanh đơn cùng tốc độ và giúp CPU, đặc biệt là đồ họa tích hợp, hoạt động nhanh hơn.`),
        ],
      },
      {
        heading: "Tốc độ và độ trễ",
        paragraphs: [
          paragraph(
            bus && `Tốc độ ${bus} quyết định lượng dữ liệu RAM trao đổi được với CPU mỗi giây; bus càng cao thì băng thông càng lớn, có lợi rõ nhất cho đồ họa tích hợp và các tác vụ nặng về bộ nhớ.`,
            cas && `Chỉ số ${cas} (CAS Latency) cho biết độ trễ truy cập; ở cùng tốc độ, con số càng thấp thì phản hồi càng nhanh.`,
            voltage && `Điện áp hoạt động ${voltage}.`,
          ),
        ],
      },
      {
        heading: "Hồ sơ XMP / EXPO",
        paragraphs: [
          paragraph(
            xmp
              ? `RAM có hồ sơ Intel XMP${expo ? " và AMD EXPO" : ""} lưu sẵn thông số ép xung an toàn từ nhà sản xuất. Sau khi lắp, bạn vào BIOS bật XMP${expo ? " (hoặc EXPO trên nền AMD)" : ""} để RAM chạy đúng tốc độ ${bus ?? "công bố"}; nếu không, RAM sẽ chạy ở tốc độ mặc định thấp hơn.`
              : `Thanh RAM chạy theo thông số chuẩn JEDEC nên gần như cắm là chạy, không cần cấu hình thêm trong BIOS và có độ tương thích rộng với nhiều bo mạch chủ.`,
          ),
        ],
      },
      {
        heading: "Thiết kế và tương thích",
        paragraphs: [
          paragraph(
            `Đây là RAM ${type ?? ""} dạng DIMM dành cho máy tính để bàn, không dùng cho laptop. Trước khi mua, hãy kiểm tra bo mạch chủ của bạn dùng DDR4 hay DDR5 vì hai loại có khe cắm khác nhau.`.replace("  ", " "),
            heatspreader && "Tấm tản nhiệt kim loại giúp thanh RAM tản nhiệt tốt hơn khi chạy lâu ở tốc độ cao.",
            rgb && "Dải LED RGB tạo điểm nhấn trong case kính, thường điều khiển được bằng phần mềm hoặc đồng bộ với bo mạch chủ.",
          ),
        ],
      },
    ],
    audience:
      total !== undefined && total >= 48
        ? `${name} phù hợp với máy trạm và người làm đồ họa, dựng phim, mô phỏng — những công việc cần dung lượng RAM rất lớn.`
        : total !== undefined && total >= 32
          ? `${name} phù hợp với game thủ cấu hình cao, streamer và người làm sáng tạo nội dung cần đa nhiệm thoải mái.`
          : `${name} phù hợp với người muốn nâng cấp máy cũ hoặc lắp mới một bộ PC học tập, văn phòng, gaming phổ thông với chi phí hợp lý.`,
    specs: [
      ["Dung lượng", kit],
      ["Loại RAM", type],
      ["Tốc độ (Bus)", bus],
      ["Độ trễ (CAS)", cas],
      ["Điện áp", voltage],
      ["Chế độ kênh", dual ? "Dual Channel (kit nhiều thanh)" : modules === 1 ? "Single Channel (một thanh)" : undefined],
      ["Hồ sơ ép xung", xmp === undefined ? undefined : `${xmp ? "Intel XMP" : "Không có XMP"}${expo ? ", AMD EXPO" : ""}`],
      ["Tản nhiệt", heatspreader === undefined ? undefined : heatspreader ? "Có tấm tản nhiệt" : "Không"],
      ["Đèn LED", rgb === undefined ? undefined : rgb ? "RGB" : "Không"],
      ["Dạng RAM", "DIMM (máy tính để bàn)"],
    ],
    chips: [total ? `${total}GB` : undefined, type, tight(bus), cas],
    summary: [kit, type, bus, cas],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 36),
  };
}

/* -------------------------------------------------------------------------- */
/*  Card đồ hoạ                                                               */
/* -------------------------------------------------------------------------- */

/** Kiến trúc GPU theo tên dòng; chỉ những dòng đã biết chắc, không đoán */
function gpuArchitecture(line: string | undefined): string | undefined {
  if (!line) return undefined;
  if (/RTX\s*50\d\d/i.test(line)) return "Blackwell";
  if (/RTX\s*40\d\d/i.test(line)) return "Ada Lovelace";
  if (/RTX\s*30\d\d/i.test(line)) return "Ampere";
  if (/Arc\s*B\d{3}/i.test(line)) return "Battlemage";
  if (/RX\s*90\d\d/i.test(line)) return "RDNA 4";
  if (/RX\s*7\d\d\d/i.test(line)) return "RDNA 3";
  return undefined;
}

/** Tên GPU trong tên sản phẩm; chính xác hơn thuộc tính "Dòng VGA" (nhiều mẫu chỉ ghi "RTX 50 Series") */
const GPU_IN_NAME = /((?:GeForce\s+)?RTX\s*\d{4}(?:\s*(?:Ti|SUPER))*|(?:Radeon\s+)?RX\s*\d{4}(?:\s*XT)?|Arc\s*B\d{3})/i;

export function vga({ item, name, brand, a, seed }: Ctx): Draft {
  const lineAttr = a.get(/^Dòng VGA$/);
  const line = (item.name.match(GPU_IN_NAME)?.[1] ?? (lineAttr && !/series/i.test(lineAttr) ? lineAttr : undefined))
    ?.replace(/(\d)(Ti|XT)\b/i, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const vram = a.get(/^Bộ nhớ \(VRAM\)$/);
  const vramGb = firstNumber(vram);
  const memType = a.get(/^Kiểu bộ nhớ$/);
  const bus = a.get(/^Bus bộ nhớ$/)?.replace(/^(\d+)\s*b$/i, "$1-bit");
  const boost = a.get(/^Xung nhịp GPU Boost$/);
  const cuda = a.get(/^Số nhân CUDA Cores/);
  const stream = a.get(/^Số nhân Stream Processors/);
  const pcie = a.get(/^Chuẩn giao tiếp$/);
  const ports = a.get(/^Cổng kết nối$/);
  const power = a.get(/^Đầu cấp nguồn$/);
  const psu = a.get(/^Nguồn đề xuất$/);
  const tdp = a.get(/^TDP$/);
  const size = a.get(/^Kích thước card$/);
  const fans = a.get(/^Số quạt tản nhiệt$/);
  const slots = a.get(/^Số slot chiếm dụng$/);
  const dlss = a.get(/^Hỗ trợ DLSS$/);
  const rayTracing = a.flag(/^Hỗ trợ Ray Tracing$/);
  // Tên dòng tản nhiệt của hãng ("WINDFORCE", "TWINSTAR"); nhiều mẫu điền cả tên sản phẩm vào đây nên bỏ giá trị dài
  const coolingRaw = a.get(/^Dòng sản phẩm$/);
  const cooling = coolingRaw && coolingRaw.length <= 24 && !/card/i.test(coolingRaw) ? coolingRaw : undefined;
  const arch = gpuArchitecture(line);
  const hasDlss = dlss !== undefined && /dlss/i.test(dlss);

  const vendor = /geforce|rtx/i.test(item.name) ? "NVIDIA" : /radeon|\brx\b/i.test(item.name) ? "AMD" : /arc/i.test(item.name) ? "Intel" : undefined;
  // "GeForce RTX 5070 Ti", "Radeon RX 6500 XT", "Arc B580"
  const gpu = line
    ? vendor === "NVIDIA" && !/geforce/i.test(line)
      ? `GeForce ${line}`
      : vendor === "AMD" && !/radeon/i.test(line)
        ? `Radeon ${line}`
        : line
    : undefined;
  const shortGpu = line?.replace(/^(GeForce|Radeon)\s+/i, "");

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là card đồ họa${brand ? ` của ${brand}` : ""} trang bị GPU ${vendor ?? ""} ${gpu ?? ""}${arch ? ` thuộc thế hệ ${arch}` : ""}`.replace(/\s+/g, " ") + ".",
      vram && `Card có ${vram}${memType ? ` ${memType}` : ""}${bus ? `, giao tiếp bộ nhớ ${bus}` : ""}${cooling ? `, tản nhiệt ${cooling}` : ""}, mang lại khung hình mượt cho những tựa game hiện đại và các tác vụ đồ họa.`,
    ),
    paragraph(
      `Muốn nâng cấp sức mạnh đồ họa cho bộ PC, ${midSentence(name)} là lựa chọn đáng chú ý trong phân khúc của mình.`,
      gpu && vram && `GPU ${gpu} đi cùng ${vram}${memType ? ` ${memType}` : ""}${boost ? `, xung nhịp boost lên tới ${boost}` : ""}, đáp ứng cả chơi game lẫn dựng hình và sáng tạo nội dung.`,
    ),
  ]);

  const tierText =
    vramGb === undefined
      ? undefined
      : vramGb >= 16
        ? "Với dung lượng VRAM lớn, card thoải mái chơi game ở độ phân giải 2K và 4K, đồng thời xử lý tốt các dự án dựng hình, render và AI cần nhiều bộ nhớ đồ họa."
        : vramGb >= 12
          ? "Dung lượng VRAM này phù hợp chơi game ở độ phân giải 2K với thiết lập cao, đồng thời còn dư địa cho các tựa game đời mới dùng texture lớn."
          : vramGb >= 8
            ? "Dung lượng VRAM này đủ để chơi hầu hết game hiện nay ở Full HD với thiết lập cao và nhiều tựa game ở 2K với thiết lập vừa phải; một số game đời mới yêu cầu texture lớn có thể cần hạ chi tiết."
            : "Card hướng tới chơi game Full HD, eSports và các tựa game nhẹ đến trung bình với chi phí dễ tiếp cận.";

  return {
    titleParts: [shortGpu, vram && `${vram}${memType ? ` ${memType}` : ""}`, boost && `Boost ${tight(boost)}`, fans],
    intro,
    sections: [
      {
        heading: gpu ? `GPU ${gpu}${arch ? ` – kiến trúc ${arch}` : ""}` : "Nhân đồ họa",
        paragraphs: [
          paragraph(
            gpu && `Trái tim của card là GPU ${gpu}${arch ? ` xây dựng trên kiến trúc ${arch}` : ""}${cuda ? ` với ${cuda} CUDA` : stream ? ` với ${stream} Stream Processor` : ""}${boost ? `, xung nhịp boost ${boost}` : ""}.`,
            hasDlss && `Card hỗ trợ ${dlss} — công nghệ dùng AI để tăng số khung hình và cải thiện chất lượng hình ảnh ở các tựa game được hỗ trợ.`,
            rayTracing && "Ray Tracing phần cứng giúp ánh sáng, bóng đổ và phản chiếu trong game chân thực hơn.",
          ),
        ],
      },
      {
        heading: vram ? `Bộ nhớ ${vram}${memType ? ` ${memType}` : ""}` : "Bộ nhớ đồ họa",
        paragraphs: [
          paragraph(
            vram && `Card dùng ${vram}${memType ? ` ${memType}` : ""}${bus ? ` trên bus ${bus}` : ""}. VRAM là nơi lưu texture và dữ liệu hình ảnh; dung lượng quá thấp sẽ làm game giật khi bật chi tiết cao.`,
            tierText,
          ),
        ],
      },
      {
        heading: "Tản nhiệt và kích thước",
        paragraphs: [
          paragraph(
            fans && `Card trang bị ${fans}${cooling ? ` thuộc dòng tản nhiệt ${cooling}` : ""}${slots ? `, chiếm ${slots}` : ""}${size ? `, kích thước ${size}` : ""}.`,
            "Trước khi mua, hãy kiểm tra chiều dài tối đa card mà case hỗ trợ và số khe PCIe còn trống ở bo mạch chủ để bảo đảm lắp vừa.",
          ),
        ],
      },
      {
        heading: "Nguồn điện và cổng xuất hình",
        paragraphs: [
          paragraph(
            tdp && `Công suất tiêu thụ của card khoảng ${tdp}${psu ? `, hãng khuyến nghị nguồn từ ${psu} trở lên` : ""}.`,
            power && `Đầu cấp nguồn: ${power}.${/16-pin|12v/i.test(power) ? " Hãy đảm bảo nguồn của bạn có cáp tương ứng (12V-2x6 / 12VHPWR) hoặc dùng bộ chuyển đổi đi kèm card." : ""}`,
            pcie && `Card kết nối bo mạch qua ${pcie}.`,
            ports && `Cổng xuất hình: ${noDot(ports)}, đủ để cắm nhiều màn hình cùng lúc.`,
          ),
        ],
      },
    ],
    audience:
      vramGb !== undefined && vramGb >= 16
        ? `${name} phù hợp với game thủ muốn chơi ở độ phân giải cao, người dựng phim, làm đồ họa 3D và AI cần card mạnh với nhiều bộ nhớ.`
        : vramGb !== undefined && vramGb >= 12
          ? `${name} phù hợp với game thủ chơi ở 2K và người làm sáng tạo nội dung cần một card cân bằng giữa hiệu năng và chi phí.`
          : `${name} phù hợp với game thủ chơi ở Full HD, eSports và các bộ PC học tập, giải trí muốn có đồ họa mạnh hơn hẳn đồ họa tích hợp.`,
    specs: [
      ["GPU", gpu ? `${vendor ? `${vendor} ` : ""}${gpu}`.trim() : undefined],
      ["Kiến trúc", arch],
      ["Bộ nhớ", vram ? `${vram}${memType ? ` ${memType}` : ""}${bus ? `, ${bus}` : ""}` : undefined],
      ["Xung nhịp boost", boost],
      ["Nhân CUDA / Stream Processor", cuda ?? stream],
      ["Chuẩn giao tiếp", pcie],
      ["Cổng xuất hình", ports],
      ["Đầu cấp nguồn", power],
      ["Công suất (TDP)", tdp],
      ["Nguồn đề xuất", psu],
      ["Tản nhiệt", fans ? `${fans}${slots ? `, ${slots}` : ""}` : undefined],
      ["Kích thước card", size],
      ["DLSS", hasDlss ? dlss : undefined],
      ["Ray Tracing", rayTracing === undefined ? undefined : rayTracing ? "Có" : "Không"],
    ],
    chips: [vramGb ? `${vramGb}GB ${memType ?? ""}`.trim() : undefined, line?.replace(/^GeForce\s+|^Radeon\s+/i, ""), boost && `Up ${tight(boost)}`],
    summary: [line?.replace(/^GeForce\s+|^Radeon\s+/i, ""), vram && `${vram}${memType ? ` ${memType}` : ""}`, bus, fans],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 36),
  };
}

/* -------------------------------------------------------------------------- */
/*  SSD                                                                       */
/* -------------------------------------------------------------------------- */

export function ssd({ item, name, brand, a, seed }: Ctx): Draft {
  const gigabytes = toGigabytes(a.get(/^Dung lượng ổ cứng$/)) ?? toGigabytes(item.name);
  const capacity = gigabytes ? formatCapacity(gigabytes) : undefined;
  const iface = a.get(/^Chuẩn giao tiếp$/);
  const gen = iface?.match(/Gen\s*(\d)(?:\.\d)?/i)?.[1];
  const lanes = iface?.match(/x(\d)\b/i)?.[1];
  const formFactor = a.get(/^Kích cỡ \(Form Factor\)$/);
  const read = firstNumber(a.get(/^Tốc độ đọc$/));
  const write = firstNumber(a.get(/^Tốc độ ghi$/));
  const nand = a.get(/^Loại chip nhớ$/);
  const tbw = a.get(/^TBW/);
  const mtbf = firstNumber(a.get(/^MTBF$/)?.replace(/[,.](?=\d{3})/g, ""));
  const cache = a.get(/^Cache$/);
  const cooling = a.get(/^Tản nhiệt$/);
  const hasHeatsink = cooling !== undefined && /nhôm|tản|heatsink/i.test(cooling) && !/^không/i.test(cooling);
  const pcieText = gen ? `PCIe ${gen}.0${lanes ? ` x${lanes}` : ""}` : undefined;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là ổ cứng SSD${brand ? ` của ${brand}` : ""} chuẩn ${formFactor ?? "M.2"}${pcieText ? `, giao tiếp NVMe ${pcieText}` : ""}${capacity ? `, dung lượng ${capacity}` : ""}.`,
      read && write && `Tốc độ đọc tuần tự tới ${thousands(read)} MB/s và ghi tới ${thousands(write)} MB/s, giúp máy khởi động, mở game và chép dữ liệu nhanh hơn hẳn ổ cứng cơ HDD.`,
    ),
    paragraph(
      `Thay HDD bằng SSD là nâng cấp đáng tiền nhất cho một chiếc máy tính, và ${midSentence(name)} là lựa chọn dễ bắt đầu.`,
      capacity && `Ổ có dung lượng ${capacity}${read ? `, tốc độ đọc lên tới ${thousands(read)} MB/s` : ""}${nand ? `, dùng bộ nhớ ${nand}` : ""}.`,
    ),
  ]);

  return {
    titleParts: [capacity, pcieText && `NVMe ${pcieText}`, formFactor, read ? `đọc ${thousands(read)}MB/s` : undefined, write ? `ghi ${thousands(write)}MB/s` : undefined],
    intro,
    sections: [
      {
        heading: "Tốc độ đọc ghi",
        paragraphs: [
          paragraph(
            read && write && `Ổ đạt tốc độ đọc tuần tự tới ${thousands(read)} MB/s và ghi tuần tự tới ${thousands(write)} MB/s (số liệu công bố của hãng, đo trong điều kiện thử nghiệm lý tưởng).`,
            pcieText && `Giao tiếp NVMe qua ${pcieText} cho độ trễ thấp và băng thông lớn hơn nhiều so với SSD SATA. Ổ vẫn tương thích ngược với khe M.2 chuẩn thấp hơn, chỉ là tốc độ tối đa sẽ bị giới hạn theo khe.`,
            "Trong sử dụng thực tế, bạn sẽ thấy rõ nhất ở thời gian khởi động Windows, tải màn chơi và mở các dự án lớn.",
          ),
        ],
      },
      {
        heading: "Độ bền và bộ nhớ NAND",
        paragraphs: [
          paragraph(
            nand && `Ổ dùng bộ nhớ ${nand}${/qlc/i.test(nand) ? ", cho dung lượng lớn với chi phí thấp; đổi lại tuổi thọ ghi thường thấp hơn TLC nên phù hợp nhu cầu phổ thông hơn là ghi dữ liệu liên tục" : ""}.`,
            tbw && `Độ bền ghi (TBW) ${tbw}: đây là tổng lượng dữ liệu có thể ghi vào ổ trong vòng đời bảo hành.`,
            mtbf && `Thời gian trung bình giữa hai lần hỏng (MTBF) ${thousands(mtbf)} giờ.`,
            cache && !/không công bố/i.test(cache) && `Bộ nhớ đệm ${cache} giúp duy trì tốc độ ghi ổn định.`,
          ),
        ],
      },
      {
        heading: "Lắp đặt và tương thích",
        paragraphs: [
          paragraph(
            formFactor && `Ổ có kích thước ${formFactor}: cắm trực tiếp vào khe M.2 trên bo mạch chủ hoặc laptop hỗ trợ, không cần cáp nguồn hay cáp dữ liệu rời.`,
            hasHeatsink ? `Ổ có ${cooling.toLowerCase()} giúp giữ nhiệt độ ổn định khi ghi dữ liệu liên tục.` : "Ổ không kèm tản nhiệt; nhiều bo mạch chủ có sẵn tấm tản nhiệt cho khe M.2, hãy tận dụng để hạn chế giảm tốc do nóng.",
            "Bạn nên kiểm tra khe M.2 của thiết bị có hỗ trợ giao tiếp NVMe hay không trước khi mua.",
          ),
        ],
      },
    ],
    audience:
      gigabytes !== undefined && gigabytes >= 2000
        ? `${name} phù hợp với game thủ có thư viện game lớn, người dựng video và làm đồ họa cần dung lượng rộng cùng tốc độ cao.`
        : gigabytes !== undefined && gigabytes >= 1000
          ? `${name} phù hợp cho ổ chính của PC gaming hoặc máy làm việc: đủ chỗ cho hệ điều hành, nhiều game và dữ liệu công việc.`
          : `${name} phù hợp để làm ổ cài hệ điều hành và ứng dụng, giúp máy cũ nhanh hẳn lên với chi phí thấp.`,
    specs: [
      ["Dung lượng", capacity],
      ["Chuẩn kết nối", iface],
      ["Form factor", formFactor],
      ["Tốc độ đọc tuần tự", read ? `Tới ${thousands(read)} MB/s` : undefined],
      ["Tốc độ ghi tuần tự", write ? `Tới ${thousands(write)} MB/s` : undefined],
      ["Loại NAND", nand],
      ["Bộ nhớ đệm", cache && !/không công bố/i.test(cache) ? cache : undefined],
      ["Độ bền (TBW)", tbw],
      ["MTBF", mtbf ? `${thousands(mtbf)} giờ` : undefined],
      ["Tản nhiệt", cooling],
      ["Nhiệt độ hoạt động", a.get(/^Nhiệt độ hoạt động$/)],
    ],
    chips: [capacity, pcieText, read ? `${thousands(read)}MB/s` : undefined],
    summary: [capacity, pcieText && `NVMe ${pcieText}`, formFactor, read && `Đọc ${thousands(read)}MB/s`],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 36),
  };
}

/* -------------------------------------------------------------------------- */
/*  Nguồn máy tính                                                            */
/* -------------------------------------------------------------------------- */

const PROTECTIONS: Record<string, string> = {
  OVP: "quá áp (OVP)",
  UVP: "thấp áp (UVP)",
  OCP: "quá dòng (OCP)",
  OPP: "quá công suất (OPP)",
  SCP: "ngắn mạch (SCP)",
  OTP: "quá nhiệt (OTP)",
};

export function psu({ name, brand, a, seed }: Ctx): Draft {
  const watt = a.get(/^Công suất tối đa$/, /^Công suất$/);
  const wattNum = firstNumber(watt);
  const cert = a.get(/^Chuẩn chứng nhận$/);
  const std = a.get(/^Phiên bản chuẩn$/, /^Chuẩn nguồn$/);
  const modular = a.get(/^Loại modular$/, /^Kiểu dây nguồn$/);
  const efficiency = a.get(/^Hiệu suất$/);
  const fanSize = a.get(/^Kích thước quạt$/);
  const fanMode = a.get(/^Chế độ quạt$/);
  const size = a.get(/^Kích thước$/);
  const protections = a.get(/^Tính năng bảo vệ$/);
  const input = a.get(/^Điện áp đầu vào$/);
  const connectors = a.get(/^Số cổng cắm$/);
  const atx3 = std !== undefined && /ATX\s*3\.\d/i.test(std);
  const isModular = modular !== undefined && !/non/i.test(modular);

  const protectionNames = protections
    ? compact(protections.split(/[,\s]+/).map((code) => PROTECTIONS[code.toUpperCase()]))
    : [];

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là bộ nguồn máy tính${brand ? ` của ${brand}` : ""} công suất ${watt ?? "cao"}${cert ? `, đạt chứng nhận ${cert}` : ""}${std ? `, chuẩn ${std}` : ""}.`,
      "Nguồn là thành phần quyết định độ ổn định và tuổi thọ của cả bộ máy, nên đây là khoản đầu tư không nên tiết kiệm quá tay.",
    ),
    paragraph(
      `Một bộ nguồn tốt giúp linh kiện đắt tiền hoạt động ổn định và bền hơn. ${name} mang tới ${watt ?? "công suất"} điện${cert ? `, ${cert}` : ""}${isModular && modular ? ` và thiết kế ${modular}` : ""}.`,
    ),
  ]);

  return {
    titleParts: [watt, cert, std, modular],
    intro,
    sections: [
      {
        heading: watt ? `Công suất ${watt}${cert ? ` và chuẩn ${cert}` : ""}` : "Công suất và hiệu suất",
        paragraphs: [
          paragraph(
            watt && `Công suất ${watt} đủ cấp điện cho ${wattNum !== undefined && wattNum >= 1000 ? "cấu hình cao cấp với card đồ họa mạnh và CPU nhiều nhân, còn dư địa để nâng cấp về sau" : wattNum !== undefined && wattNum >= 750 ? "các bộ PC gaming tầm trung đến cao với card đồ họa rời" : "các bộ PC văn phòng, học tập và gaming phổ thông"}.`,
            cert && `Chứng nhận ${cert} cho biết hiệu suất chuyển đổi điện: hạng càng cao (White, Bronze, Silver, Gold, Platinum, Titanium) thì càng ít điện bị hao thành nhiệt, máy mát hơn và tiền điện thấp hơn.${efficiency ? ` Hiệu suất công bố khoảng ${efficiency}.` : ""}`,
            input && `Điện áp đầu vào ${input}.`,
          ),
        ],
      },
      {
        heading: "Cáp nguồn và lắp đặt",
        paragraphs: [
          paragraph(
            modular && `Thiết kế ${modular}: ${/full/i.test(modular) ? "toàn bộ dây có thể tháo rời, bạn chỉ lắp những dây cần dùng nên hộp máy gọn gàng và luồng khí tốt hơn" : /semi/i.test(modular) ? "các dây chính cố định, dây phụ tháo rời được, cân bằng giữa gọn gàng và chi phí" : "dây cắm cố định nên giá dễ tiếp cận; hãy chọn case có chỗ giấu dây tốt để đi dây gọn"}.`,
            atx3 && `Chuẩn ${std} hỗ trợ đầu cấp nguồn 12V-2x6 (12VHPWR) cho card đồ họa đời mới và chịu được đột biến công suất tốt hơn các chuẩn cũ.`,
            size && `Kích thước ${size}${/mm/.test(size) ? "" : " mm"}: kiểm tra case có đủ chỗ đặt nguồn.`,
            connectors && `Đầu cắm: ${noDot(connectors)}.`,
          ),
        ],
      },
      {
        heading: "Quạt và độ ồn",
        paragraphs: [
          paragraph(
            fanSize && `Nguồn dùng quạt ${fanSize}; quạt lớn thường quay chậm hơn ở cùng lưu lượng gió nên êm hơn.`,
            fanMode && /zero/i.test(fanMode) && "Chế độ Zero RPM cho phép quạt dừng hẳn khi tải thấp, máy gần như im lặng lúc làm việc nhẹ.",
          ),
        ],
      },
      {
        heading: "Bảo vệ an toàn cho linh kiện",
        paragraphs: [
          paragraph(
            protectionNames.length > 0 ? `Nguồn tích hợp các cơ chế bảo vệ ${listVi(protectionNames)}, hạn chế rủi ro cho bo mạch chủ, card đồ họa và ổ cứng khi điện lưới không ổn định.` : protections && `Các cơ chế bảo vệ: ${noDot(protections)}.`,
          ),
        ],
      },
    ],
    audience:
      wattNum !== undefined && wattNum >= 1000
        ? `${name} phù hợp với cấu hình cao cấp: card đồ họa đầu bảng, CPU nhiều nhân, máy trạm hoặc PC cần dư công suất để ép xung và nâng cấp.`
        : `${name} phù hợp với bộ PC gaming và làm việc cần nguồn ổn định, hiệu suất tốt và đủ công suất cho các linh kiện hiện tại.`,
    specs: [
      ["Công suất", watt],
      ["Chứng nhận hiệu suất", cert],
      ["Hiệu suất", efficiency],
      ["Chuẩn nguồn", std],
      ["Kiểu dây", modular],
      ["Quạt", fanSize ? `${fanSize}${fanMode ? `, ${fanMode}` : ""}` : undefined],
      ["Kích thước", size],
      ["Điện áp đầu vào", input],
      ["Bảo vệ", protections],
      ["Đầu cắm", connectors],
    ],
    chips: [watt && tight(watt), cert?.replace(/^80 Plus\s*/i, "80+ "), modular],
    summary: [watt, cert, std, modular],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 36),
  };
}

/* -------------------------------------------------------------------------- */
/*  Vỏ case                                                                   */
/* -------------------------------------------------------------------------- */

export function pcCase({ name, brand, a, seed }: Ctx): Draft {
  const mb = a.get(/^Hỗ trợ main$/);
  const dims = a.get(/^Kích thước case$/);
  const color = a.get(/^Màu sắc$/);
  const material = a.get(/^Chất liệu$/);
  const glass = a.flag(/^Mặt kính cường lực$/);
  const fansIncluded = a.get(/^Số lượng quạt đi kèm$/);
  const front = a.get(/^Quạt tản nhiệt mặt trước$/);
  const rear = a.get(/^Quạt tản nhiệt mặt sau$/);
  const top = a.get(/^Quạt tản nhiệt mặt trên$/);
  const radiator = a.get(/^Hỗ trợ tản nhiệt nước/);
  const cooler = a.get(/^Chiều cao tản nhiệt CPU tối đa$/);
  const gpuLength = a.get(/^Độ dài VGA tối đa$/);
  const usb3 = a.get(/^Cổng USB 3\.0$/);
  const usbC = a.get(/^Cổng USB Type-C$/);
  const pci = a.get(/^Khe cắm mở rộng PCI$/);
  const bays = a.get(/^Khay gắn ổ cứng$/);
  const rgb = a.flag(/^LED RGB$/);
  const psuPosition = a.get(/^Vị trí đặt nguồn$/);
  const eatx = mb !== undefined && /e-?atx/i.test(mb);
  const atx = mb !== undefined && /\batx\b/i.test(mb.replace(/micro-?atx|e-?atx/gi, ""));
  const size = eatx ? "E-ATX / ATX" : atx ? "ATX" : mb ? "Micro-ATX" : undefined;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là vỏ case${brand ? ` của ${brand}` : ""}${color ? ` màu ${color.toLowerCase()}` : ""}${glass ? " với mặt kính cường lực" : ""}${mb ? `, hỗ trợ bo mạch chủ ${mb}` : ""}.`,
      "Case không chỉ là chiếc hộp chứa linh kiện: thiết kế luồng khí, chỗ đi dây và không gian lắp đặt quyết định máy chạy mát, êm và dễ nâng cấp đến đâu.",
    ),
    paragraph(
      `Bộ PC đẹp bắt đầu từ chiếc case phù hợp. ${name} mang thiết kế hiện đại${glass ? ", khoe trọn linh kiện qua mặt kính cường lực" : ""}${rgb ? " cùng hệ đèn RGB" : ""}, đồng thời chú trọng khả năng tản nhiệt và lắp đặt linh kiện dễ dàng.`,
    ),
  ]);

  return {
    titleParts: [color, mb && `Hỗ trợ ${mb}`, glass ? "Kính cường lực" : undefined, fansIncluded && `${fansIncluded} quạt kèm theo`.replace(/\s*cái\s*quạt/i, " quạt")],
    intro,
    sections: [
      {
        heading: "Thiết kế và chất liệu",
        paragraphs: [
          paragraph(
            material && `Vỏ case làm từ ${material.toLowerCase()}, cho cảm giác chắc chắn và bền bỉ khi vận chuyển hoặc tháo lắp nhiều lần.`,
            glass && "Mặt kính cường lực trong suốt giúp bạn khoe trọn dàn linh kiện bên trong, đồng thời chịu lực và chịu nhiệt tốt hơn kính thường.",
            dims && `Kích thước tổng thể ${dims}${/mm/.test(dims) ? "" : " mm"}; hãy đo không gian đặt máy trước khi mua.`,
          ),
        ],
      },
      {
        heading: "Không gian lắp đặt linh kiện",
        paragraphs: [
          paragraph(
            mb && `Case hỗ trợ các cỡ bo mạch chủ: ${mb}.`,
            gpuLength && `Card đồ họa dài tối đa ${gpuLength}${/mm/i.test(gpuLength) ? "" : " mm"}${cooler ? `, tản nhiệt CPU cao tối đa ${cooler}${/mm/i.test(cooler) ? "" : " mm"}` : ""}.`,
            pci && `${pci} khe mở rộng${psuPosition ? `; nguồn đặt ở phía ${psuPosition.toLowerCase()} giúp tách nhiệt khỏi các linh kiện chính` : ""}.`,
            bays && `Khay ổ cứng: ${noDot(bays)}.`,
          ),
        ],
      },
      {
        heading: "Luồng khí và tản nhiệt",
        paragraphs: [
          paragraph(
            fansIncluded && `Case đi kèm ${fansIncluded.toLowerCase()} quạt${fansIncluded.startsWith("0") ? "; bạn nên bổ sung quạt để máy có luồng khí ổn định" : ""}.`,
            (front || rear || top) && `Vị trí quạt: ${compact([front && `mặt trước ${noDot(front)}`, rear && `mặt sau ${noDot(rear)}`, top && `mặt trên ${noDot(top)}`]).join("; ")}.`,
            radiator && `Hỗ trợ lắp tản nhiệt nước (radiator) cỡ ${radiator}${/mm/i.test(radiator) ? "" : " mm"}, thuận tiện cho những cấu hình tản nhiệt nước AIO.`,
          ),
        ],
      },
      {
        heading: "Cổng kết nối phía trước",
        paragraphs: [
          paragraph(
            (usb3 || usbC) && `Bảng cổng phía trước gồm${compact([usb3 && ` ${usb3} USB 3.0`, usbC && ` ${usbC} USB Type-C`]).join(" và")}, tiện cắm ổ USB, tai nghe và thiết bị ngoại vi mà không phải với ra phía sau.`,
            rgb && "Hệ đèn LED RGB tạo điểm nhấn ánh sáng cho bàn làm việc.",
          ),
        ],
      },
    ],
    audience: eatx
      ? `${name} phù hợp với người dựng cấu hình cao cấp: bo mạch cỡ lớn, card đồ họa dài, nhiều quạt và tản nhiệt nước, hoặc muốn một chiếc case để khoe trọn dàn máy.`
      : `${name} phù hợp với người dựng PC gaming và làm việc cần một chiếc case đẹp, dễ lắp đặt và có đủ không gian cho tản nhiệt.`,
    specs: [
      ["Hỗ trợ bo mạch chủ", mb],
      ["Kích thước", dims],
      ["Màu sắc", color],
      ["Chất liệu", material],
      ["Mặt kính cường lực", glass === undefined ? undefined : glass ? "Có" : "Không"],
      ["Quạt đi kèm", fansIncluded],
      ["Quạt mặt trước", front],
      ["Quạt mặt sau", rear],
      ["Quạt mặt trên", top],
      ["Tản nhiệt nước", radiator],
      ["Chiều cao tản CPU tối đa", cooler],
      ["Độ dài VGA tối đa", gpuLength],
      ["Khe mở rộng", pci],
      ["Khay ổ cứng", bays],
      ["Cổng USB 3.0 / Type-C", usb3 || usbC ? compact([usb3 && `${usb3} USB 3.0`, usbC && `${usbC} Type-C`]).join(", ") : undefined],
      ["Đèn LED RGB", rgb === undefined ? undefined : rgb ? "Có" : "Không"],
    ],
    chips: [color, size, glass ? "Kính cường lực" : undefined],
    summary: [color, mb && `Hỗ trợ ${mb}`, glass ? "Kính cường lực" : undefined, fansIncluded && `${fansIncluded} quạt`.replace(/\s*cái\s*quạt/i, " quạt")],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}
