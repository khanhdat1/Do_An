/**
 * Phần "Lưu ý khi chọn mua và sử dụng" và "Câu hỏi thường gặp" của bài mô tả.
 *
 * Đây là kiến thức phổ thông về từng loại sản phẩm (không phải chữ của nguồn), có gắn vào vài thông số
 * của chính sản phẩm khi có. Người mua thường phân vân đúng những điều này, và đây cũng là chỗ bài mô tả
 * thể hiện cửa hàng tư vấn thật chứ không chỉ chép lại bảng thông số.
 */
import { firstNumber, formatCapacity, toGigabytes } from "../attributes.js";
import { compact, type Ctx, type Maybe } from "./common.js";

export interface Extras {
  tips: Maybe[];
  /** Mỗi phần tử là một cặp "Câu hỏi? — Trả lời." */
  faq: Maybe[];
}

const qa = (question: string, answer: string) => `${question} — ${answer}`;

/** Dòng bảo hành dùng chung cho câu hỏi cuối */
function warrantyQa(ctx: Ctx): string {
  const months = firstNumber(ctx.a.get(/^Bảo hành$/));
  return qa(
    "Sản phẩm được bảo hành như thế nào?",
    months
      ? `Hàng chính hãng, bảo hành ${months} tháng theo chính sách của nhà sản xuất; PCZone hỗ trợ tiếp nhận và làm việc với hãng giúp bạn.`
      : "Hàng chính hãng, bảo hành theo chính sách của nhà sản xuất; PCZone hỗ trợ tiếp nhận và làm việc với hãng giúp bạn.",
  );
}

const EXTRAS: Record<string, (ctx: Ctx) => Extras> = {
  cpu({ item, a }) {
    const socket = a.get(/^Socket$/);
    const tdp = a.get(/^TDP \(Điện năng tiêu thụ\)$/, /^TDP$/);
    const ramType = a.get(/^Hỗ trợ loại RAM$/);
    const hasIgpu = a.flag(/^Đồ họa tích hợp$/);
    const tray = /\btray\b/i.test(item.name);
    return {
      tips: [
        socket && `Kiểm tra socket ${socket} và chipset của bo mạch chủ trước khi mua; cùng socket nhưng khác đời chipset có thể cần cập nhật BIOS mới chạy được.`,
        tray ? "Bản Tray không kèm tản nhiệt: hãy chuẩn bị sẵn tản khí hoặc tản nước phù hợp với mức tiêu thụ điện của chip." : "Kiểm tra trong hộp có kèm tản nhiệt hay không; nếu không có, cần mua tản nhiệt riêng trước khi lắp.",
        "Bôi keo tản nhiệt mỏng và đều, lắp tản đúng lực siết để chip giữ được nhiệt độ thấp khi chạy tải nặng.",
        tdp && `Chọn nguồn có công suất dư so với tổng mức tiêu thụ của cả hệ thống (CPU ${tdp} chỉ là một phần, card đồ họa thường ngốn điện hơn).`,
        ramType && `Chọn RAM ${ramType} tương thích và nhớ bật hồ sơ XMP/EXPO trong BIOS để RAM chạy đúng tốc độ.`,
      ],
      faq: [
        qa("Có cần mua thêm tản nhiệt không?", tray ? "Cần, vì bản Tray không kèm tản nhiệt." : "Nếu hộp không có tản nhiệt đi kèm thì cần. Ngay cả khi có, người chơi game nặng hoặc render lâu nên cân nhắc tản tốt hơn để chip mát và êm hơn."),
        socket && qa("CPU này ghép được với những bo mạch chủ nào?", `Các bo mạch chủ dùng socket ${socket}. Hãy nhờ PCZone tư vấn chipset phù hợp với ngân sách và nhu cầu để tránh mua nhầm.`),
        hasIgpu === false
          ? qa("Có cần card đồ họa rời không?", "Có. Chip không có nhân đồ họa tích hợp nên cần card đồ họa rời thì máy mới xuất được hình.")
          : hasIgpu
            ? qa("Chưa có card đồ họa rời thì dùng được không?", "Được. Chip có đồ họa tích hợp, đủ cho văn phòng, xem phim và chơi game nhẹ; chơi game nặng nên bổ sung card rời.")
            : undefined,
      ],
    };
  },

  mainboard({ a }) {
    const socket = a.get(/^Socket$/);
    const ramType = a.get(/^Kiểu RAM hỗ trợ$/);
    const form = a.get(/^Kích thước$/);
    const wifi = a.get(/^Wi-Fi$/);
    return {
      tips: [
        socket && `Chọn CPU đúng socket ${socket} và đúng đời chipset mà bo mạch hỗ trợ; tra danh sách CPU tương thích của hãng nếu cần.`,
        ramType && `Bo mạch dùng RAM ${ramType}; không cắm lẫn DDR4 và DDR5 được.`,
        form && `Kiểm tra case hỗ trợ cỡ ${form} trước khi mua, đặc biệt khi chọn case nhỏ.`,
        "Cập nhật BIOS mới nhất trước khi lắp CPU đời mới, và lắp cột chống (standoff) đúng vị trí để tránh chập mạch.",
      ],
      faq: [
        qa("Bo mạch có cần cập nhật BIOS không?", "Với CPU đời mới hơn thời điểm bo mạch ra mắt thì có thể cần. PCZone kiểm tra và hỗ trợ cập nhật khi bạn mua kèm CPU."),
        wifi && !/^không/i.test(wifi) ? qa("Có cần mua thêm card Wi-Fi không?", "Không, bo mạch đã tích hợp Wi-Fi; chỉ cần gắn ăng-ten đi kèm.") : qa("Bo mạch có Wi-Fi không?", "Bo mạch không tích hợp Wi-Fi. Nếu cần kết nối không dây, bạn có thể bổ sung card Wi-Fi hoặc bộ thu USB."),
        qa("Bo mạch có ép xung được không?", "Khả năng ép xung phụ thuộc vào chipset và CPU bạn chọn (thường cần CPU mở khóa hệ số nhân và chipset dòng cao). Hãy hỏi PCZone để được tư vấn cụ thể."),
      ],
    };
  },

  ram({ a, item }) {
    const type = a.get(/^Loại RAM$/) ?? item.name.match(/DDR[345]/i)?.[0].toUpperCase();
    const bus = a.get(/^Bus RAM$/);
    const modules = Number(item.name.match(/(\d+)\s*x\s*\d+\s*GB/i)?.[1] ?? firstNumber(a.get(/^Số lượng thanh$/)) ?? 1);
    return {
      tips: [
        type && `Kiểm tra bo mạch chủ dùng ${type} trước khi mua; DDR4 và DDR5 có khe cắm khác nhau và không dùng lẫn được.`,
        bus && `Sau khi lắp, vào BIOS bật XMP/EXPO để RAM chạy đúng tốc độ ${bus}; không bật thì RAM thường chạy ở tốc độ mặc định thấp hơn.`,
        modules > 1 && "Với kit nhiều thanh, cắm đúng cặp khe theo hướng dẫn trên bo mạch để chạy Dual Channel.",
        "Nếu gắn thêm RAM vào máy đã có sẵn, nên chọn cùng loại, cùng tốc độ và cùng dung lượng để hệ thống ổn định nhất.",
      ],
      faq: [
        qa("RAM này dùng được cho laptop không?", "Không. Đây là RAM dạng DIMM cho máy tính để bàn; laptop dùng RAM dạng SO-DIMM có kích thước nhỏ hơn."),
        qa("Nên chọn dung lượng bao nhiêu?", "16 GB là mức phổ biến cho máy chơi game hiện nay; 32 GB trở lên nếu bạn dựng video, làm đồ họa hoặc chạy máy ảo."),
        qa("Có cần tản nhiệt riêng cho RAM không?", "Không bắt buộc. Thanh RAM có tấm tản nhiệt sẵn thường đã đủ cho sử dụng thông thường."),
      ],
    };
  },

  vga({ a }) {
    const psu = a.get(/^Nguồn đề xuất$/);
    const power = a.get(/^Đầu cấp nguồn$/);
    const size = a.get(/^Kích thước card$/);
    return {
      tips: [
        psu && `Hãng khuyến nghị nguồn từ ${psu}; nên chọn nguồn chất lượng tốt, có công suất dư để hệ thống ổn định khi chơi game nặng.`,
        power && `Card dùng đầu cấp nguồn ${power}: hãy chắc chắn nguồn của bạn có đủ đầu cắm tương ứng.`,
        size && `Card có kích thước ${size}; đối chiếu với chiều dài VGA tối đa mà case hỗ trợ.`,
        "Cập nhật driver mới nhất từ hãng sản xuất chip đồ họa để có hiệu năng và độ ổn định tốt nhất.",
        "Nên cắm màn hình vào cổng của card đồ họa chứ không phải cổng trên bo mạch chủ, nếu không máy sẽ dùng đồ họa tích hợp.",
      ],
      faq: [
        qa("Card này có lắp được vào mọi bo mạch chủ không?", "Card dùng khe PCIe x16, có trên hầu hết bo mạch chủ hiện nay và tương thích ngược với các đời PCIe cũ hơn, chỉ cần chú ý không gian trong case và nguồn."),
        qa("Có cần nguồn mới khi nâng cấp card không?", "Còn tùy công suất và đầu cắm của nguồn hiện tại; hãy đối chiếu với mức nguồn đề xuất ở trên hoặc hỏi PCZone để được kiểm tra giúp."),
        qa("Có dùng card này để dựng phim, render được không?", "Được. Card đồ họa rời tăng tốc rõ rệt cho dựng phim, render 3D và nhiều phần mềm sáng tạo nội dung có hỗ trợ tăng tốc bằng GPU."),
      ],
    };
  },

  ssd({ a }) {
    const gen = a.get(/^Chuẩn giao tiếp$/)?.match(/Gen\s*(\d)/i)?.[1];
    return {
      tips: [
        "Kiểm tra khe M.2 của máy có hỗ trợ NVMe (chứ không chỉ SATA) và đủ chiều dài 2280 trước khi mua.",
        gen && `Ổ dùng giao tiếp PCIe Gen ${gen}; cắm vào khe chuẩn thấp hơn vẫn chạy nhưng tốc độ bị giới hạn theo khe.`,
        "Không nên để ổ đầy quá 80–90% dung lượng vì sẽ giảm tốc độ ghi và tuổi thọ.",
        "Sao lưu dữ liệu quan trọng định kỳ; SSD nào cũng có thể hỏng và không có cảnh báo dài như ổ cứng cơ.",
      ],
      faq: [
        qa("Cài Windows vào ổ này được không?", "Được. Đây là lựa chọn tốt để làm ổ hệ điều hành; máy sẽ khởi động chỉ trong vài giây."),
        qa("Ổ có dùng được cho PS5 hoặc laptop không?", "Còn tùy thiết bị: cần đúng chuẩn, đúng chiều dài và có khe M.2 tương thích (một số máy đòi hỏi tản nhiệt riêng). Hãy hỏi PCZone trước khi mua."),
        qa("Có cần cài driver không?", "Thường không; Windows nhận ổ NVMe ngay. Bạn chỉ cần cập nhật firmware khi hãng khuyến nghị."),
      ],
    };
  },

  psu({ a }) {
    const watt = a.get(/^Công suất tối đa$/, /^Công suất$/);
    const modular = a.get(/^Loại modular$/, /^Kiểu dây nguồn$/);
    return {
      tips: [
        watt && `Nguồn ${watt}: cộng công suất của CPU, card đồ họa và các linh kiện khác rồi chừa dư 20–30% để nguồn vận hành mát và bền.`,
        "Nếu card đồ họa dùng đầu cấp nguồn 16-pin (12V-2x6), hãy kiểm tra nguồn có cáp tương ứng hoặc dùng bộ chuyển đổi chính hãng đi kèm card.",
        modular && !/non/i.test(modular) ? "Chỉ cắm những dây cần dùng và cất các dây thừa để thùng máy gọn, luồng khí thoáng." : "Với nguồn dây liền, hãy chọn case có chỗ giấu dây rộng để đi dây gọn gàng.",
        "Đặt quạt nguồn hướng ra phía có khe thoáng và vệ sinh bụi định kỳ để nguồn không bị nóng.",
      ],
      faq: [
        qa("Có nên chọn nguồn công suất lớn hơn mức cần thiết?", "Một chút dư công suất là tốt vì nguồn chạy ở mức tải vừa phải sẽ mát, êm và bền hơn; nhưng không cần quá lớn vì sẽ lãng phí."),
        qa("Chứng nhận 80 Plus có quan trọng không?", "Nó cho biết hiệu suất chuyển đổi điện. Hạng cao hơn tiết kiệm điện và tỏa nhiệt ít hơn, nhưng độ ổn định còn phụ thuộc vào linh kiện bên trong nguồn."),
        qa("Nguồn có tự động tắt khi quá tải không?", "Nguồn có các cơ chế bảo vệ như quá dòng, quá áp, ngắn mạch; tuy vậy vẫn nên chọn công suất phù hợp thay vì trông chờ vào bảo vệ."),
      ],
    };
  },

  case({ a }) {
    const mb = a.get(/^Hỗ trợ main$/);
    const gpuLength = a.get(/^Độ dài VGA tối đa$/);
    const fans = a.get(/^Số lượng quạt đi kèm$/);
    return {
      tips: [
        mb && `Case hỗ trợ bo mạch ${mb}; đối chiếu cỡ bo mạch của bạn trước khi mua.`,
        gpuLength && `Chiều dài card đồ họa tối đa ${gpuLength}${/mm/i.test(gpuLength) ? "" : " mm"}; đo cả độ dày khi lắp cùng tản nhiệt nước ở phía trước.`,
        fans && `Case kèm ${fans.toLowerCase()} quạt; nên bố trí quạt hút phía trước và quạt thoát phía sau/trên để luồng khí thông suốt.`,
        "Đi dây phía sau khay bo mạch chủ và buộc gọn để không cản luồng gió, đồng thời máy trông sạch sẽ hơn.",
      ],
      faq: [
        qa("Case này có lắp được tản nhiệt nước không?", "Còn tùy kích thước radiator; hãy xem mục tản nhiệt nước trong bảng thông số hoặc hỏi PCZone để được kiểm tra tương thích."),
        qa("Mặt kính cường lực có dễ vỡ không?", "Kính cường lực chịu lực tốt hơn kính thường nhưng vẫn nên tránh va đập mạnh vào cạnh kính khi vận chuyển và tháo lắp."),
        qa("Cần mua thêm quạt không?", "Còn tùy số quạt đi kèm và cấu hình của bạn. Với cấu hình nhiều nhiệt (CPU và card đồ họa mạnh), thêm quạt hút/thoát thường giúp nhiệt độ giảm rõ rệt."),
      ],
    };
  },

  "laptop-gaming": (ctx) => laptopExtras(ctx, true),
  "laptop-van-phong": (ctx) => laptopExtras(ctx, false),

  "pc-gaming": (ctx) => pcExtras(ctx),
  "pc-workstation": (ctx) => pcExtras(ctx),

  "man-hinh"({ item, a }) {
    const hz = firstNumber(a.get(/^Tần số quét$/) ?? item.name.match(/(\d{2,3})\s*Hz/i)?.[0]);
    const ports = a.get(/^Cổng kết nối$/);
    const res = a.get(/^Độ phân giải$/);
    return {
      tips: [
        hz && hz > 60 && `Để tận dụng tần số quét ${hz}Hz, hãy cắm bằng cáp DisplayPort hoặc HDMI đúng chuẩn và vào phần cài đặt hiển thị của Windows chọn đúng tần số.`,
        res && `Độ phân giải ${res} cần card đồ họa đủ mạnh để chơi game mượt; chọn thiết lập đồ họa phù hợp với cấu hình.`,
        ports && `Cổng kết nối gồm ${ports}; kiểm tra máy tính của bạn có cổng tương thích trước khi mua.`,
        "Đặt màn hình sao cho mép trên ngang tầm mắt và cách mắt khoảng một sải tay để đỡ mỏi cổ, mỏi mắt.",
      ],
      faq: [
        qa("Màn hình này có cần card đồ họa rời không?", "Không bắt buộc cho công việc văn phòng; nhưng muốn chơi game ở độ phân giải và tần số quét cao thì cần card đồ họa đủ mạnh."),
        qa("Có gắn được lên tay treo màn hình không?", "Nếu màn hình có chuẩn treo VESA (xem bảng thông số) thì gắn được lên giá treo hoặc tay đỡ tương thích."),
        qa("Có điểm chết pixel không?", "Màn hình chính hãng được kiểm tra khi nhận hàng; nếu phát hiện lỗi điểm ảnh vượt mức cho phép của hãng, PCZone hỗ trợ đổi theo chính sách bảo hành."),
      ],
    };
  },

  "ban-phim"({ a }) {
    const connection = a.get(/^Phương thức kết nối$/);
    const switchName = a.get(/^Tên Switch$/);
    return {
      tips: [
        switchName && `Bàn phím dùng switch ${switchName}; nếu chưa quen, bạn có thể thử ở cửa hàng để chọn độ nhấn phù hợp.`,
        connection && /bluetooth|wireless|2\.4/i.test(connection) && "Sạc pin đầy trước khi mang đi làm việc và tắt đèn nền khi không cần để kéo dài thời lượng pin.",
        "Vệ sinh keycap và khe phím định kỳ bằng chổi mềm hoặc khí nén để tránh bụi làm kẹt phím.",
        "Cài phần mềm của hãng để gán phím, tạo macro và cập nhật firmware khi có bản mới.",
      ],
      faq: [
        qa("Bàn phím có dùng được với macOS không?", "Xem mục hệ điều hành tương thích trong bảng thông số; nhiều bàn phím có công tắc chuyển layout Windows/macOS."),
        qa("Có thể thay keycap hoặc switch không?", "Tùy mẫu: bàn phím cơ hỗ trợ hot-swap cho phép thay switch không cần hàn, còn keycap thường thay được nếu đúng chuẩn trục."),
        qa("Gõ có ồn không?", "Độ ồn phụ thuộc loại switch và cấu trúc bên trong; switch Linear thường êm hơn switch Clicky."),
      ],
    };
  },

  chuot({ a }) {
    const battery = a.get(/^Thời lượng pin$/);
    const dpi = a.get(/^Độ phân giải \(DPI\)$/);
    return {
      tips: [
        dpi && `Chuột có DPI ${dpi}; đa số game thủ dùng mức thấp đến trung bình (400–1600 DPI) rồi chỉnh độ nhạy trong game để ngắm chính xác.`,
        battery && `Thời lượng pin khoảng ${battery}; nên sạc khi còn khoảng 20% để pin bền hơn.`,
        "Dùng tấm lót chuột phù hợp (vải hoặc cứng) để chân chuột trượt tốt và cảm biến bám chính xác.",
        "Cài phần mềm của hãng để chỉnh DPI, gán nút và cập nhật firmware.",
      ],
      faq: [
        qa("Chuột không dây có bị trễ khi chơi game không?", "Kết nối không dây 2.4GHz chuyên dụng cho game hiện nay có độ trễ rất thấp, gần như không phân biệt được với chuột có dây trong sử dụng thông thường."),
        qa("Chuột này hợp với kiểu cầm nào?", "Kích thước và kiểu dáng nằm ở bảng thông số; nếu bàn tay bạn nhỏ hoặc lớn, hãy đối chiếu số đo với bàn tay để chọn cho vừa."),
        qa("Có dùng được trên macOS không?", "Chuột dùng được trên macOS với các chức năng cơ bản; phần mềm tùy chỉnh có thể chỉ hỗ trợ Windows, xem mục thông số phần mềm."),
      ],
    };
  },
};

function laptopExtras({ a }: Ctx, gaming: boolean): Extras {
  const ramMax = a.get(/^RAM nâng cấp tối đa$/);
  const ssdMaxGb = toGigabytes(a.get(/^SSD nâng cấp tối đa$/));
  const ssdMax = ssdMaxGb ? formatCapacity(ssdMaxGb) : undefined;
  return {
    tips: [
      gaming && "Khi chơi game nặng nên cắm sạc, chọn chế độ hiệu năng cao và kê máy thoáng để tản nhiệt tốt.",
      gaming && "Dùng đế tản nhiệt hoặc kê máy nghiêng khi chơi lâu để giảm nhiệt độ và giữ hiệu năng ổn định.",
      "Cập nhật driver và BIOS từ hãng định kỳ để máy ổn định và tối ưu pin.",
      !gaming && "Bật chế độ tiết kiệm pin khi di chuyển và hạn chế để pin cạn hẳn thường xuyên để pin bền hơn.",
      ramMax || ssdMax ? `Máy có thể nâng cấp${ramMax ? ` RAM tối đa ${ramMax}` : ""}${ssdMax ? `${ramMax ? " và" : ""} ổ cứng tới ${ssdMax}` : ""} — hãy nhờ PCZone nâng cấp để không ảnh hưởng bảo hành.` : undefined,
    ],
    faq: [
      qa("Máy có sẵn Windows bản quyền không?", "Xem mục hệ điều hành trong bảng thông số; phiên bản cài sẵn tùy cấu hình từng model."),
      qa("Laptop có nâng cấp được không?", "Tùy model: đa số cho phép nâng RAM và SSD. Thông tin khả năng nâng cấp nằm trong phần lưu trữ ở trên."),
      gaming
        ? qa("Chơi game có nóng máy không?", "Laptop gaming được thiết kế tản nhiệt riêng, nhưng khi chơi lâu máy vẫn nóng lên. Cắm sạc, chọn chế độ hiệu năng phù hợp và kê máy thoáng sẽ giúp nhiệt độ ổn định.")
        : qa("Máy có dùng được cho học lập trình và thiết kế cơ bản không?", "Được, với các tác vụ học tập, lập trình và thiết kế cơ bản. Công việc dựng hình hoặc render nặng nên chọn máy có card đồ họa rời."),
    ],
  };
}

function pcExtras({ a }: Ctx): Extras {
  const ram = a.get(/^RAM$/);
  return {
    tips: [
      "Nhận máy, kiểm tra ngoại quan và bật thử ngay để xác nhận cấu hình khớp với bảng thông số.",
      "Cập nhật driver card đồ họa mới nhất và bật XMP/EXPO trong BIOS (nếu chưa bật sẵn) để RAM chạy đúng tốc độ.",
      "Đặt máy ở nơi thoáng, cách tường vài cm để luồng khí vào ra thuận lợi và vệ sinh bụi định kỳ 3–6 tháng.",
      ram && `Máy đang có ${ram} RAM; khi cần nâng cấp, hãy hỏi PCZone để chọn đúng loại RAM tương thích.`,
    ],
    faq: [
      qa("Bộ PC có đi kèm màn hình, bàn phím, chuột không?", "Bộ PC bán theo cấu hình như bảng thông số, chưa gồm màn hình và phụ kiện. PCZone có thể tư vấn combo màn hình, bàn phím, chuột phù hợp."),
      qa("Có thể thay đổi cấu hình theo nhu cầu không?", "Có. Bạn có thể yêu cầu đổi RAM, ổ cứng hoặc card đồ họa; PCZone sẽ báo giá chênh lệch và lắp đặt trước khi giao."),
      qa("Bảo hành cả bộ máy ra sao?", "Bộ máy được bảo hành 36 tháng theo chính sách của PCZone; từng linh kiện chính hãng còn được hưởng bảo hành của nhà sản xuất."),
    ],
  };
}

export function buildExtras(ctx: Ctx): { tips: string[]; faq: string[] } {
  const extras = EXTRAS[ctx.item.category]?.(ctx);
  return {
    tips: compact(extras?.tips ?? []),
    // Bộ PC đã có câu hỏi bảo hành riêng (bảo hành của PCZone, không phải của hãng)
    faq: [...compact(extras?.faq ?? []), ...(ctx.item.category.startsWith("pc-") ? [] : [warrantyQa(ctx)])],
  };
}
