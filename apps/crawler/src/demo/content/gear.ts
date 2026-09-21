/**
 * Nội dung cho các thiết bị ngoại vi còn lại của Gaming Gear: tai nghe, loa, ghế, bàn.
 * (Bàn phím và chuột nằm ở devices.ts.) Mỗi hàm nhận thông số của một sản phẩm và trả về `Draft` (xem common.ts).
 *
 * Bảng thông số của nguồn cho các nhóm này rất thất thường: cùng một nhãn có khi ghi "40mm", khi ghi "40 mm",
 * khi chỉ ghi "2.5" không đơn vị; ô "Độ nhạy" của tai nghe có chỗ chứa cả dải tần "70 Hz-20 KHz dB". Vì vậy các hàm
 * ở đây chỉ tin những giá trị có dạng đúng và bỏ những giá trị còn lại thay vì in nguyên chuỗi lạ.
 */
import { firstNumber, firstPart } from "../attributes.js";
import { pickVariant } from "../names.js";
import { listVi, lowerList, noDot, paragraph, warrantyMonths, type Ctx, type Draft } from "./common.js";

const lower = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
const tight = (value: string | undefined) => value?.replace(/\s+/g, "");

/** "40mm" → "40 mm", "290g" → "290 g"; giá trị không có số thì bỏ */
function withUnit(value: string | undefined): string | undefined {
  if (!value || !/\d/.test(value)) return undefined;
  return value.replace(/(\d)\s*(mm|cm|kg|g|Wh|dB|Hz|kHz|Ω)(?![\p{L}\p{N}])/giu, "$1 $2").replace(/\bkhz\b/i, "kHz").replace(/\s+/g, " ").trim();
}

/** Chỉ nhận giá trị thật sự có đơn vị tần số ("20 Hz - 20 kHz"); ô ghi lẫn lộn thì bỏ */
const frequency = (value: string | undefined) => (value && /hz/i.test(value) ? withUnit(value) : undefined);

/** Độ nhạy tai nghe tính bằng dB; ô có Hz/kHz là dải tần điền nhầm ô */
const sensitivity = (value: string | undefined) => (value && /\bdb\b/i.test(value) && !/hz/i.test(value) ? withUnit(value) : undefined);

/* -------------------------------------------------------------------------- */
/*  Tai nghe                                                                  */
/* -------------------------------------------------------------------------- */

export function headset({ name, brand, a, seed }: Ctx): Draft {
  const kind = a.get(/^Kiểu tai nghe$/);
  const connection = a.get(/^Phương thức kết nối$/);
  const port = a.get(/^Cổng kết nối$/);
  const usage = a.get(/^Nhu cầu sử dụng$/);
  const sound = a.get(/^Công nghệ âm thanh$/);
  const driver = withUnit(a.get(/^Kích thước màng loa$/));
  const freq = frequency(a.get(/^Tần số phản hồi$/));
  const impedance = withUnit(a.get(/^Trở kháng$/));
  const sens = sensitivity(a.get(/^Độ nhạy$/));
  const mic = a.flag(/^Micro$/);
  const micFeature = a.get(/^Tính năng micro$/);
  const battery = a.get(/^Thời lượng pin$/);
  const charge = a.get(/^Cổng sạc$/);
  const weight = withUnit(a.get(/^Trọng lượng$/));
  const cable = withUnit(a.get(/^Chiều dài dây$/));
  const padMaterial = a.get(/^Chất liệu đệm tai$/);
  const led = a.get(/^Đèn LED$/);
  const compat = a.get(/^Tương thích$/);
  const software = a.get(/^Phần mềm hỗ trợ$/);
  const macSoftware = a.flag(/^Hỗ trợ phần mềm cho MacOS$/);
  const accessories = a.get(/^Phụ kiện đi kèm$/);
  const color = a.get(/^Màu sắc$/);

  const dongle = connection !== undefined && /2\.4|usb receiver|dongle|lightspeed|hyperspeed/i.test(connection);
  const bluetooth = connection !== undefined && /bluetooth/i.test(connection);
  const wired = connection !== undefined && /có dây|jack|3\.5/i.test(connection);
  const wireless = dongle || bluetooth;
  const inEar = kind !== undefined && /in-?ear|earbud|nhét tai/i.test(kind);
  const overEar = kind !== undefined && /over|chụp tai|gaming/i.test(kind);
  const anc = sound !== undefined && /chống ồn|anc|noise/i.test(sound);
  const surround = sound !== undefined && /7\.1|surround|spatial|dolby|dts/i.test(sound);
  const batteryHours = firstNumber(battery);

  const connLabel = dongle && bluetooth ? "2.4GHz + Bluetooth" : dongle ? "Không dây 2.4GHz" : bluetooth ? "Bluetooth" : wired ? "Có dây" : undefined;
  // Nguồn ghi tính năng micro khi thì "Cardioid, Mic mute cảm ứng", khi thì "Micro thu âm đa hướng, ...": chỉ thêm
  // chữ "Micro" đứng đầu khi giá trị chưa có
  const micLine = mic === true ? (micFeature ? (/^micro/i.test(micFeature) ? noDot(micFeature) : `Micro ${lower(noDot(micFeature))}`) : "Có micro") : undefined;
  // Pin ghi nhiều chế độ ("Bluetooth (25 giờ), Dongle (20 giờ)") thì quá dài cho chip trên thẻ
  const batteryChip = battery && battery.length <= 14 ? `Pin ${battery}` : undefined;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là tai nghe${kind ? ` ${lower(kind)}` : ""}${brand ? ` của ${brand}` : ""}${connLabel ? `, kết nối ${lower(connLabel)}` : ""}${driver ? `, màng loa ${driver}` : ""}.`,
      usage ? `Sản phẩm hướng tới nhu cầu ${lowerList(usage)}, ${mic === true ? "có micro để trò chuyện và họp trực tuyến" : "tập trung vào chất âm"}.` : undefined,
    ),
    paragraph(
      `Trong game, âm thanh quan trọng không kém hình ảnh: tiếng bước chân, tiếng nạp đạn cho bạn biết đối thủ ở đâu trước khi kịp nhìn thấy. ${name} tập trung vào điều đó.`,
      driver && `Màng loa ${driver}${freq ? `, dải tần ${freq}` : ""}${impedance ? `, trở kháng ${impedance}` : ""}.`,
      wireless && batteryHours !== undefined && `Pin dùng được khoảng ${battery} mỗi lần sạc.`,
    ),
  ]);

  return {
    titleParts: [kind, connLabel, driver && `Driver ${driver}`, battery && `Pin ${battery}`],
    intro,
    sections: [
      {
        heading: "Chất âm và micro",
        paragraphs: [
          paragraph(
            driver && `Củ loa (màng loa) ${driver} tạo ra âm thanh; đường kính càng lớn thường cho tiếng trầm đầy hơn, còn độ chi tiết còn phụ thuộc cách hãng tinh chỉnh.`,
            freq && `Dải tần phản hồi ${freq}, bao trọn dải nghe của tai người từ trầm tới cao.`,
            impedance && `Trở kháng ${impedance}${firstNumber(impedance) !== undefined && (firstNumber(impedance) as number) <= 64 ? " thấp nên tai nghe dễ kéo, chạy tốt cả trên điện thoại và máy tính mà không cần bộ khuếch đại riêng" : ""}.`,
            sens && `Độ nhạy ${sens}.`,
            sound && `Công nghệ âm thanh: ${noDot(sound)}.`,
            surround && "Âm thanh vòm giúp bạn định vị hướng bước chân, tiếng súng trong game FPS tốt hơn.",
            anc && "Chống ồn chủ động giảm tiếng quạt, tiếng xe và tạp âm nền để bạn tập trung hơn.",
          ),
          paragraph(
            micLine && `${micLine}${mic === true ? "." : ""}`,
            micFeature && /cardioid/i.test(micFeature) && "Kiểu thu cardioid ưu tiên giọng nói ở phía trước và giảm tiếng ồn xung quanh, giúp đồng đội nghe rõ bạn hơn.",
            mic === false && "Tai nghe không kèm micro; nếu cần trò chuyện bạn có thể dùng micro rời hoặc micro trên bàn phím, webcam.",
          ),
        ],
      },
      {
        heading: "Kết nối và thời lượng pin",
        paragraphs: [
          paragraph(
            connection && `Phương thức kết nối: ${noDot(connection)}.`,
            port && `Cổng kết nối: ${noDot(port)}.`,
            dongle && "Đầu thu 2.4GHz cắm vào cổng USB cho độ trễ rất thấp, là lựa chọn nên dùng khi chơi game.",
            bluetooth && "Bluetooth tiện khi nghe nhạc, xem phim hoặc nhận cuộc gọi trên điện thoại; độ trễ cao hơn đầu thu 2.4GHz nên không phải lựa chọn tối ưu cho game hành động.",
            wired && !wireless && "Kết nối có dây nên không cần sạc pin và độ trễ gần như bằng không.",
            cable && `Dây dài ${cable}.`,
          ),
          paragraph(
            battery && `Thời lượng pin khoảng ${battery}${charge ? `, sạc qua cổng ${noDot(charge)}` : ""}.`,
            batteryHours !== undefined && batteryHours >= 30 && "Pin lâu như vậy đủ dùng cả tuần với thói quen chơi game vài giờ mỗi ngày.",
          ),
        ],
      },
      {
        heading: "Thiết kế và độ thoải mái",
        paragraphs: [
          paragraph(
            inEar && "Kiểu nhét tai (in-ear) nhỏ gọn, bịt kín ống tai nên cách âm thụ động khá tốt và dễ mang theo; nên chọn đúng cỡ nút tai để nghe thoải mái và bass đầy hơn.",
            overEar && !inEar && "Kiểu chụp tai ôm trọn vành tai, cách âm thụ động tốt và cho sân khấu âm thanh rộng, phù hợp những phiên chơi game và nghe nhạc dài.",
            padMaterial && `Đệm tai làm từ ${lower(padMaterial)}.`,
            weight && `Trọng lượng ${weight}${(firstNumber(weight) ?? 0) >= 250 ? " — nhẹ hay nặng tùy bạn cảm nhận, nên thử đeo ít nhất vài chục phút" : ""}.`,
            led && !/^không/i.test(led) && `Đèn LED: ${noDot(led)}.`,
            color && `Màu sắc: ${noDot(color)}.`,
          ),
        ],
      },
      {
        heading: "Phần mềm và tương thích",
        paragraphs: [
          paragraph(
            compat && `Tương thích: ${noDot(compat)}.`,
            software && `Phần mềm hỗ trợ: ${noDot(software)}, dùng để chỉnh EQ, hiệu ứng âm thanh và micro${macSoftware === true ? "; có bản cho macOS" : macSoftware === false ? "; chưa hỗ trợ macOS" : ""}.`,
          ),
        ],
        bullets: accessories ? [`Trong hộp: ${noDot(accessories)}`] : undefined,
      },
    ],
    audience: `${name} phù hợp với ${usage ? lowerList(usage) : "game thủ và người thích nghe nhạc"} — những ai muốn âm thanh rõ, đeo thoải mái và ${wireless ? "không bị vướng dây" : "một chiếc tai nghe bền, ổn định"}.`,
    specs: [
      ["Kiểu tai nghe", kind],
      ["Kết nối", connection],
      ["Cổng kết nối", port],
      ["Màng loa", driver],
      ["Tần số phản hồi", freq],
      ["Trở kháng", impedance],
      ["Độ nhạy", sens],
      ["Micro", mic === true ? micFeature ?? "Có" : mic === false ? "Không" : undefined],
      ["Công nghệ âm thanh", sound],
      ["Thời lượng pin", battery],
      ["Cổng sạc", charge],
      ["Chiều dài dây", cable],
      ["Trọng lượng", weight],
      ["Đèn LED", led],
      ["Tương thích", compat],
      ["Phần mềm", software],
      ["Màu sắc", color],
    ],
    chips: [kind && (inEar ? "In-ear" : kind), connLabel, batteryChip ?? (mic === true ? "Có micro" : undefined), driver && `Driver ${tight(driver)}`, anc ? "Chống ồn chủ động" : undefined],
    summary: [kind, connLabel, driver && `Driver ${driver}`, battery && `Pin ${battery}`],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}

/* -------------------------------------------------------------------------- */
/*  Loa                                                                       */
/* -------------------------------------------------------------------------- */

export function speaker({ name, brand, a, seed }: Ctx): Draft {
  const type = a.get(/^Loại sản phẩm$/);
  const connection = a.get(/^Kết nối$/);
  const power = a.get(/^Công suất$/);
  const channels = a.get(/^Hệ thống loa$/);
  // "2.5" hay "0.75" không đơn vị là số liệu điền thiếu: chỉ nhận khi có chữ ("5" woofers, 3.5 inch mid-bass)
  const drivers = (() => {
    const value = a.get(/^Kích thước loa driver$/);
    return value && /[a-zA-Z"”]/.test(value) ? value : undefined;
  })();
  const freq = frequency(a.get(/^Tần số đáp ứng$/));
  const snr = a.get(/^Tỷ lệ SNR$/);
  const sound = a.get(/^Công nghệ âm thanh$/);
  const btVersion = a.get(/^Phiên bản Bluetooth$/);
  const rgb = a.flag(/^LED RGB$/);
  const remote = a.flag(/^Điều khiển từ xa$/);
  const bassTreble = a.flag(/^Điều chỉnh Bass\/Treble$/);
  const material = a.get(/^Chất liệu vỏ$/);
  const powerSupply = a.get(/^Nguồn điện$/);
  const impedance = withUnit(a.get(/^Trở kháng$/));
  const software = a.get(/^Phần mềm$/);
  const weight = withUnit(a.get(/^Trọng lượng$/));
  const size = a.get(/^Kích thước$/);
  const color = a.get(/^Màu sắc$/);
  const accessories = a.get(/^Phụ kiện đi kèm$/);

  const bluetooth = (connection !== undefined && /bluetooth/i.test(connection)) || (btVersion !== undefined && /bluetooth/i.test(btVersion));
  const studio = type !== undefined && /kiểm âm|studio/i.test(type);
  const portable = type !== undefined && /di động|portable/i.test(type);
  const subwoofer = channels !== undefined && /2\.1/.test(channels);
  const btLabel = btVersion && /bluetooth/i.test(btVersion) ? btVersion : bluetooth ? "Bluetooth" : undefined;

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là ${type ? lower(type) : "loa"}${brand ? ` của ${brand}` : ""}${channels ? `, hệ thống ${lower(channels)}` : ""}${power ? `, công suất ${lower(power)}` : ""}.`,
      btLabel ? `Loa hỗ trợ ${btLabel}, ghép nối không dây với điện thoại, máy tính bảng và laptop rất nhanh.` : "Loa kết nối bằng dây nên tín hiệu ổn định và không phải lo chuyện ghép nối.",
    ),
    paragraph(
      `Âm thanh tốt biến góc làm việc và giải trí thành nơi đáng ngồi cả ngày. ${name} mang tới${channels ? ` hệ thống ${lower(channels)}` : " chất âm rõ ràng"}${freq ? `, dải tần ${freq}` : ""}.`,
      studio ? "Đây là dòng loa kiểm âm: ưu tiên độ trung thực hơn là tô đậm bass, hợp nghe nhạc kỹ, làm nhạc và dựng phim." : undefined,
    ),
  ]);

  return {
    titleParts: [channels, power && power.replace(/^rms\s*/i, "RMS "), btLabel, portable ? "Loa di động" : undefined],
    intro,
    sections: [
      {
        heading: "Chất âm",
        paragraphs: [
          paragraph(
            channels && `Hệ thống ${lower(channels)}${subwoofer ? ": hai loa vệ tinh cho tiếng trung – cao và một loa siêu trầm (subwoofer) riêng cho tiếng bass, nên hiệu ứng nổ và tiếng động cơ trong game đầy đặn hơn hẳn" : ""}.`,
            drivers && `Cấu hình củ loa: ${noDot(drivers)}.`,
            freq && `Dải tần đáp ứng ${freq}.`,
            snr && `Tỷ lệ tín hiệu trên nhiễu (SNR) ${noDot(snr)}: con số càng cao thì nền càng “đen”, ít tạp âm khi để âm lượng nhỏ.`,
            impedance && `Trở kháng ${impedance}.`,
            sound && `Công nghệ âm thanh: ${noDot(sound)}.`,
            studio && "Loa kiểm âm cho âm thanh phẳng, trung thực nên bạn nghe được đúng những gì có trong bản thu.",
          ),
        ],
      },
      {
        heading: "Kết nối và tiện ích",
        paragraphs: [
          paragraph(
            connection && `Cổng và kết nối: ${noDot(connection)}.`,
            btVersion && !/^không/i.test(btVersion) && `Phiên bản ${btVersion}.`,
            bassTreble === true && "Có núm chỉnh Bass/Treble để bạn tự cân lại âm sắc theo sở thích và theo từng loại nội dung.",
            remote === true && "Đi kèm điều khiển từ xa để chỉnh âm lượng và chuyển nguồn mà không phải rời ghế.",
            software && !/^không/i.test(software) && `Phần mềm đi kèm: ${noDot(software)}.`,
            powerSupply && `Nguồn điện: ${noDot(powerSupply)}.`,
          ),
        ],
      },
      {
        heading: "Thiết kế và bố trí",
        paragraphs: [
          paragraph(
            material && `Thân loa làm từ ${lower(material)}${/gỗ|mdf/i.test(material) ? ", cho tiếng ấm và ít rung hơn vỏ nhựa mỏng" : ""}.`,
            rgb === true && "Đèn RGB tạo điểm nhấn cho góc gaming, có thể tắt khi không cần.",
            size && `Kích thước ${noDot(size)}${weight ? `, nặng ${weight}` : ""}.`,
            !size && weight && `Trọng lượng ${weight}.`,
            color && `Màu sắc: ${noDot(color)}.`,
            portable && "Loa di động gọn nhẹ, mang theo đi cắm trại, du lịch hay ra ban công đều tiện.",
          ),
        ],
        bullets: accessories ? [`Trong hộp: ${noDot(accessories)}`] : undefined,
      },
    ],
    audience: `${name} phù hợp với ${studio ? "người nghe nhạc kỹ, làm nội dung và game thủ muốn chất âm trung thực" : portable ? "người thích nghe nhạc mọi lúc mọi nơi" : "game thủ, dân văn phòng và người thích xem phim nghe nhạc tại bàn làm việc"} — những ai muốn nâng cấp âm thanh khỏi loa tích hợp của laptop hay màn hình.`,
    specs: [
      ["Loại loa", type],
      ["Hệ thống loa", channels],
      ["Công suất", power],
      ["Củ loa", drivers],
      ["Dải tần", freq],
      ["Tỷ lệ SNR", snr],
      ["Kết nối", connection],
      ["Bluetooth", btVersion && !/^không/i.test(btVersion) ? btVersion : undefined],
      ["Chất liệu vỏ", material],
      ["Đèn RGB", rgb === true ? "Có" : rgb === false ? "Không" : undefined],
      ["Điều khiển từ xa", remote === true ? "Có" : remote === false ? "Không" : undefined],
      ["Nguồn điện", powerSupply],
      ["Kích thước", size],
      ["Trọng lượng", weight],
      ["Màu sắc", color],
    ],
    chips: [channels, power && tight(power.replace(/^rms\s*/i, "")), btLabel ?? (connection && firstPart(connection)?.split(/,\s*/)[0]), studio ? "Loa kiểm âm" : undefined],
    summary: [type, channels, power, btLabel],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}

/* -------------------------------------------------------------------------- */
/*  Ghế                                                                       */
/* -------------------------------------------------------------------------- */

/** Số chiều điều chỉnh của tay ghế: 1D chỉ nâng hạ, 4D thêm tiến/lùi, trái/phải, xoay góc */
function armrestText(armrest: string): string {
  const dimensions = Number(armrest.match(/(\d)\s*D/i)?.[1]);
  if (!dimensions) return `Tay ghế ${noDot(armrest)}.`;
  const adjust = ["nâng hạ độ cao", "tiến/lùi", "trái/phải", "xoay góc"].slice(0, Math.min(dimensions, 4));
  return `Tay ghế ${dimensions}D chỉnh được ${listVi(adjust)}${dimensions > 4 ? " và thêm các hướng khác" : ""}, nên dễ chỉnh cho vừa vóc dáng và tư thế làm việc.`;
}

/** Trục thủy lực: Class 4 là cấp cao nhất trong các cấp thường thấy trên ghế */
function hydraulicText(hydraulic: string): string {
  const level = Number(hydraulic.match(/class\s*(\d)/i)?.[1]);
  if (!level) return `Trụ thủy lực: ${noDot(hydraulic)}.`;
  return level >= 4
    ? `Trụ thủy lực Class ${level}, cấp cao nhất trong các cấp trục thường gặp trên ghế, chịu tải tốt và nâng hạ êm.`
    : `Trụ thủy lực Class ${level}; cấp càng cao thì thành trụ càng dày và chịu tải càng tốt.`;
}

export function chair({ name, brand, a, seed }: Ctx): Draft {
  const design = a.get(/^Kiểu thiết kế$/);
  const line = a.get(/^Dòng sản phẩm$/);
  const dimensions = a.get(/^Kích thước tổng thể$/);
  const heightMin = a.get(/^Chiều cao tối thiểu$/);
  const heightMax = a.get(/^Chiều cao tối đa$/);
  const backHeight = a.get(/^Chiều cao lưng ghế$/);
  const seatWidth = a.get(/^Chiều rộng mâm ngồi$/);
  const seatDepth = a.get(/^Chiều sâu mâm ngồi$/);
  const frame = a.get(/^Chất liệu khung ghế$/);
  const base = a.get(/^Chất liệu chân ghế$/);
  const backMaterial = a.get(/^Chất liệu lưng$/);
  const seatMaterial = a.get(/^Chất liệu đệm ngồi$/);
  const headrest = a.flag(/^Có tựa đầu$/);
  const headrestType = a.get(/^Loại tựa đầu$/);
  const armrest = a.get(/^Loại tay ghế$/);
  const armHeight = a.get(/^Độ cao tay ghế/);
  const hydraulic = a.get(/^Loại trụ thủy lực$/);
  const special = a.get(/^Tính năng đặc biệt$/);
  const maxLoad = a.get(/^Tải trọng tối đa$/);
  const lumbar = a.get(/^Tựa thắt lưng$/);
  // "152 độ (Reactive Seat Tilt - ngả lưng phản hồi theo trọng lượng)" → "152°"; "90-135 °" → "90–135°"
  const recline = a
    .get(/^Độ ngả lưng$/)
    ?.match(/\d+(?:\s*[-–]\s*\d+)?/)?.[0]
    .replace(/\s+/g, "")
    .replace("-", "–")
    .concat("°");
  const accessories = a.get(/^Phụ kiện đi kèm$/);
  const color = a.get(/^Màu sắc$/);

  const gaming = design !== undefined && /gaming/i.test(design);
  const ergonomic = (design !== undefined && /công thái học|ergonomic/i.test(design)) || /công thái học|ergonomic/i.test(name);
  const mesh = (backMaterial !== undefined && /lưới|mesh/i.test(backMaterial)) || /lưới|mesh/i.test(name);
  const kind = ergonomic ? "ghế công thái học" : gaming ? "ghế gaming" : "ghế";
  const load = firstNumber(maxLoad);
  const reclineMax = Math.max(...(recline?.match(/\d+/g)?.map(Number) ?? [0]));

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là ${kind}${brand ? ` của ${brand}` : ""}${line ? ` thuộc dòng ${line}` : ""}${backMaterial ? `, lưng bọc ${lower(noDot(backMaterial))}` : ""}${maxLoad ? `, tải trọng tối đa ${maxLoad}` : ""}.`,
      ergonomic ? "Ghế được thiết kế để nâng đỡ cột sống và giảm mỏi lưng khi ngồi làm việc nhiều giờ liền." : gaming ? "Ghế có tựa lưng cao ôm người, hợp những phiên chơi game dài và cả làm việc tại nhà." : undefined,
    ),
    paragraph(
      `Ngồi đúng tư thế quyết định việc bạn chơi hay làm việc được bao lâu mà không đau lưng. ${name} là ${kind} ${lumbar && !/^không/i.test(lumbar) ? "có tựa thắt lưng hỗ trợ đường cong tự nhiên của cột sống" : "chú trọng độ êm và chắc chắn"}${armrest ? `, tay ghế ${noDot(armrest)}` : ""}.`,
    ),
  ]);

  return {
    titleParts: [design, maxLoad && `Tải trọng ${maxLoad}`, hydraulic, recline && `Ngả ${recline}`],
    intro,
    sections: [
      {
        heading: "Thiết kế và vật liệu",
        paragraphs: [
          paragraph(
            backMaterial && `Mặt lưng ${lower(noDot(backMaterial))}${mesh ? " thoáng khí, hạn chế bí nóng khi ngồi lâu, đặc biệt hợp thời tiết nóng ẩm" : ""}.`,
            // Nguồn hay ghi luôn chữ "Đệm..." ở đầu giá trị: đừng lặp thành "Đệm ngồi đệm đúc"
            seatMaterial && `${/^đệm/i.test(seatMaterial) ? noDot(seatMaterial) : `Đệm ngồi ${lower(noDot(seatMaterial))}`}${/mút|foam/i.test(seatMaterial) ? ", đàn hồi tốt và giữ dáng sau thời gian dài sử dụng" : ""}.`,
            frame && `Khung ghế ${lower(noDot(frame))}${base ? `, chân ghế ${lower(noDot(base))}` : ""}.`,
            !frame && base && `Chân ghế ${lower(noDot(base))}.`,
            color && `Màu sắc: ${noDot(color)}.`,
          ),
        ],
      },
      {
        heading: "Điều chỉnh và nâng đỡ",
        paragraphs: [
          paragraph(
            lumbar && !/^không/i.test(lumbar) && `Tựa thắt lưng: ${noDot(lumbar)}. Điểm tựa ở vùng thắt lưng giúp giữ đường cong tự nhiên của cột sống, giảm áp lực khi ngồi lâu.`,
            headrest === true && `Ghế có tựa đầu${headrestType ? ` ${lower(noDot(headrestType))}` : ""}, đỡ cổ và vai khi bạn ngả người ra sau.`,
            headrest === false && "Ghế không có tựa đầu, gọn hơn và hợp người ngồi thẳng khi làm việc.",
            recline && `Độ ngả lưng ${recline}${reclineMax >= 150 ? ", đủ để ngả hẳn ra nghỉ ngơi giữa các ván game" : ""}.`,
            armrest && armrestText(armrest),
            armHeight && `Độ cao tay ghế tính từ mâm ngồi ${armHeight}.`,
          ),
          paragraph(hydraulic && hydraulicText(hydraulic), maxLoad && `Tải trọng tối đa ${maxLoad}${load !== undefined && load >= 130 ? ", phù hợp cả những người có vóc dáng lớn" : ""}.`),
        ],
        bullets: special ? [`Tính năng nổi bật: ${noDot(special)}`] : undefined,
      },
      {
        heading: "Kích thước",
        paragraphs: [
          paragraph(
            dimensions && `Kích thước tổng thể ${dimensions}.`,
            heightMin && heightMax && `Chiều cao ghế điều chỉnh trong khoảng ${heightMin} đến ${heightMax}.`,
            backHeight && `Chiều cao tựa lưng ${backHeight}.`,
            seatWidth && `Mâm ngồi rộng ${seatWidth}${seatDepth ? `, sâu ${seatDepth}` : ""}.`,
            !seatWidth && seatDepth && `Mâm ngồi sâu ${seatDepth}.`,
          ),
        ],
        bullets: accessories ? [`Đi kèm: ${noDot(accessories)}`] : undefined,
      },
    ],
    audience: `${name} phù hợp với ${ergonomic ? "dân văn phòng, lập trình viên, nhà thiết kế và người làm việc tại nhà ngồi nhiều giờ mỗi ngày" : "game thủ, streamer và những ai ngồi trước máy tính nhiều giờ"} — những ai muốn một chiếc ghế êm, vững và chỉnh được cho vừa dáng ngồi.`,
    specs: [
      ["Kiểu thiết kế", design],
      ["Dòng sản phẩm", line],
      ["Chất liệu lưng", backMaterial],
      ["Chất liệu đệm ngồi", seatMaterial],
      ["Khung ghế", frame],
      ["Chân ghế", base],
      ["Tựa thắt lưng", lumbar],
      ["Tựa đầu", headrest === true ? headrestType ?? "Có" : headrest === false ? "Không" : undefined],
      ["Tay ghế", armrest],
      ["Độ ngả lưng", recline],
      ["Trụ thủy lực", hydraulic],
      ["Tải trọng tối đa", maxLoad],
      ["Kích thước tổng thể", dimensions],
      ["Chiều cao", heightMin && heightMax ? `${heightMin} – ${heightMax}` : heightMax ?? heightMin],
      ["Mâm ngồi", seatWidth ? `Rộng ${seatWidth}${seatDepth ? `, sâu ${seatDepth}` : ""}` : seatDepth ? `Sâu ${seatDepth}` : undefined],
      ["Màu sắc", color],
    ],
    chips: [design, maxLoad && `Tải ${tight(maxLoad)}`, recline && `Ngả ${tight(recline)}`, hydraulic, mesh ? "Lưng lưới" : undefined],
    summary: [design, backMaterial && `Lưng ${lower(noDot(backMaterial))}`, maxLoad && `Tải trọng ${maxLoad}`, recline && `Ngả lưng ${recline}`],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}

/* -------------------------------------------------------------------------- */
/*  Bàn                                                                       */
/* -------------------------------------------------------------------------- */

/** "140 x 60 x 1.5 cm" → { length: 140, width: 60, thickness: "1.5" } */
function deskSize(value: string | undefined): { length: number; width: number } | undefined {
  const match = value?.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return undefined;
  return { length: Number(match[1].replace(",", ".")), width: Number(match[2].replace(",", ".")) };
}

export function desk({ name, brand, a, seed }: Ctx): Draft {
  const kind = a.get(/^Loại bàn$/);
  const design = a.get(/^Kiểu thiết kế$/);
  const line = a.get(/^Dòng sản phẩm$/);
  const sizeText = a.get(/^Kích thước mặt bàn$/);
  const surface = a.get(/^Chất liệu bề mặt$/);
  const legs = a.get(/^Chất liệu chân bàn$/);
  const height = a.get(/^Độ cao bàn/);
  const grommet = a.flag(/^Lỗ đi dây$/);
  const load = a.get(/^Tải trọng tối đa mặt bàn$/);
  const special = a.get(/^Tính năng đặc biệt$/);
  const color = a.get(/^Màu sắc$/);

  const size = deskSize(sizeText);
  const adjustable = /nâng hạ/i.test(`${kind ?? ""} ${name}`);
  const motor = kind !== undefined && /motor|điện/i.test(kind);
  const hydraulic = kind !== undefined && /thủy lực/i.test(kind);
  const rgb = special !== undefined && /rgb|led/i.test(special);
  const loadKg = firstNumber(load);
  const sizeShort = size ? `${size.length}×${size.width} cm` : undefined;
  const label = adjustable ? "bàn nâng hạ" : design ? lower(design.replace(/\s*\/\s*/g, " – ")) : "bàn";

  const intro = pickVariant(seed, [
    paragraph(
      `${name} là ${label}${brand ? ` của ${brand}` : ""}${line ? ` dòng ${line}` : ""}${sizeShort ? `, mặt bàn ${sizeShort}` : ""}${height ? `, chiều cao điều chỉnh ${height}` : ""}.`,
      adjustable ? "Thay vì ngồi liên tục cả ngày, bạn có thể đổi giữa tư thế ngồi và đứng chỉ bằng vài thao tác." : rgb ? "Dải đèn RGB làm góc gaming nổi bật ngay cả khi tắt đèn phòng." : undefined,
    ),
    paragraph(
      `Chiếc bàn quyết định bạn ngồi thoải mái được bao lâu và góc làm việc gọn gàng đến đâu. ${name} là ${label}${sizeShort ? ` với mặt bàn ${sizeShort}` : ""}${load ? `, tải trọng tối đa ${load}` : ""}.`,
    ),
  ]);

  return {
    titleParts: [kind ?? design, sizeShort, height && `Cao ${height}`, load && `Tải ${load}`],
    intro,
    sections: [
      {
        heading: "Kích thước và mặt bàn",
        paragraphs: [
          paragraph(
            sizeText && `Kích thước mặt bàn ${sizeText}${/\d\s*[x×]\s*\d+(?:[.,]\d+)?\s*[x×]/i.test(sizeText) ? " (dài × rộng × dày)" : ""}.`,
            size && size.length >= 120 && "Mặt bàn đủ rộng cho một màn hình lớn cùng bàn phím, chuột và các phụ kiện; đặt thêm loa hoặc laptop cạnh bên vẫn còn chỗ.",
            size && size.length < 90 && "Mặt bàn nhỏ gọn, hợp làm bàn phụ để laptop, góc học tập hoặc những căn phòng hẹp.",
            surface && `Bề mặt: ${noDot(surface)}.`,
            color && `Màu sắc: ${noDot(color)}.`,
          ),
        ],
      },
      {
        heading: adjustable ? "Khung bàn và độ cao" : "Khung bàn và thiết kế",
        paragraphs: [
          paragraph(
            legs && `Chân bàn: ${noDot(legs)}.`,
            height && `Chiều cao điều chỉnh trong khoảng ${height}${adjustable ? ", đủ để chuyển từ tư thế ngồi sang đứng làm việc" : ""}.`,
            motor && "Bàn nâng hạ bằng động cơ điện: chỉ cần bấm nút để lên xuống, nhẹ nhàng và nhanh hơn kiểu chỉnh tay.",
            hydraulic && "Bàn nâng hạ kiểu thủy lực: dùng lực đòn bẩy để nâng hạ, không cần điện nên gọn và dễ di chuyển.",
            design && `Thiết kế: ${noDot(design)}.`,
          ),
        ],
      },
      {
        heading: "Tải trọng và tiện ích",
        paragraphs: [
          paragraph(
            load && `Tải trọng tối đa mặt bàn ${load}${loadKg !== undefined ? (loadKg >= 80 ? ", đủ cho màn hình lớn, thân máy và một số phụ kiện nặng" : loadKg >= 50 ? ", đủ cho màn hình, laptop và phụ kiện thông thường" : ", hợp với laptop hoặc màn hình nhỏ, không nên đặt thiết bị quá nặng") : ""}.`,
            grommet === true && "Có lỗ đi dây để giấu dây gọn gàng, giúp mặt bàn sạch và dễ vệ sinh.",
            rgb && "Đèn LED RGB có thể đổi hiệu ứng theo sở thích, tạo điểm nhấn cho góc gaming.",
          ),
        ],
        bullets: special ? [`Tính năng nổi bật: ${noDot(special)}`] : undefined,
      },
      {
        heading: "Chọn bàn cho góc làm việc",
        paragraphs: [
          paragraph(
            "Mặt bàn sâu khoảng 60 cm là mức tối thiểu để đặt màn hình cách mắt một sải tay; nếu dùng màn hình cong, hai màn hình hoặc hay chơi game với chuột lớn, bạn nên chọn mặt bàn dài từ 140 cm trở lên.",
            "Chiều cao lý tưởng là khi khuỷu tay vuông góc, cổ tay thẳng lúc gõ phím và mép trên màn hình ngang tầm mắt.",
          ),
        ],
      },
    ],
    audience: `${name} phù hợp với ${adjustable ? "dân văn phòng, lập trình viên và game thủ muốn thay đổi tư thế ngồi – đứng trong ngày" : "game thủ, streamer và người làm việc tại nhà"} — những ai muốn một chiếc bàn vững, gọn và hợp với góc làm việc của mình.`,
    specs: [
      ["Loại bàn", kind],
      ["Kiểu thiết kế", design],
      ["Dòng sản phẩm", line],
      ["Kích thước mặt bàn", sizeText],
      ["Chất liệu bề mặt", surface],
      ["Chất liệu chân bàn", legs],
      ["Chiều cao", height],
      ["Tải trọng tối đa", load],
      ["Lỗ đi dây", grommet === true ? "Có" : grommet === false ? "Không" : undefined],
      ["Tính năng", special],
      ["Màu sắc", color],
    ],
    chips: [adjustable ? (motor ? "Nâng hạ điện" : hydraulic ? "Nâng hạ thủy lực" : "Nâng hạ") : design, sizeShort, height && `Cao ${tight(height)}`, load && `Tải ${tight(load)}`, rgb ? "Đèn RGB" : undefined],
    summary: [kind ?? design, sizeShort, height && `Cao ${height}`, load && `Tải ${load}`],
    warrantyMonths: warrantyMonths(a.get(/^Bảo hành$/), 12),
  };
}
