import type { Metadata } from "next";
import { FileText } from "lucide-react";
import PolicyArticle, { PolicyLink, PolicyList, PolicySection } from "@/components/policy/PolicyArticle";
import { getPublicSettings } from "@/lib/api";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng | PCZone",
  description: "Quy định khi dùng website PCZone: tài khoản, đặt hàng, mã giảm giá, đánh giá sản phẩm và các tính năng AI.",
};

export default async function TermsPage() {
  const { store } = await getPublicSettings();

  return (
    <PolicyArticle
      icon={FileText}
      title="Điều khoản sử dụng"
      href="/dieu-khoan-su-dung"
      intro={
        <p>
          Khi tạo tài khoản, đặt hàng hoặc dùng các tính năng của PCZone, bạn đồng ý với các điều khoản dưới đây và với{" "}
          <PolicyLink href="/chinh-sach-bao-mat">Chính sách bảo mật</PolicyLink>.
        </p>
      }
    >
      <PolicySection title="1. Tài khoản">
        <PolicyList>
          <li>Cung cấp thông tin chính xác; tự giữ bí mật mật khẩu và thiết bị đã đăng nhập.</li>
          <li>Báo ngay cho PCZone nếu nghi ngờ tài khoản bị người khác sử dụng.</li>
          <li>PCZone có thể khoá tài khoản vi phạm điều khoản hoặc có dấu hiệu gian lận.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="2. Sản phẩm, giá và đặt hàng">
        <PolicyList>
          <li>Giá, khuyến mãi và tồn kho là thông tin tại thời điểm bạn xem; có thể thay đổi mà không báo trước.</li>
          <li>
            Đơn mới đặt ở trạng thái “Chờ xác nhận” và chỉ được xử lý sau khi PCZone xác nhận. Hàng được giữ cho bạn ngay từ
            lúc đặt và trả lại kho nếu đơn bị huỷ.
          </li>
          <li>
            PCZone có thể huỷ đơn khi sản phẩm hết hàng, giá hiển thị bị sai hoặc không liên lạc được với người nhận, và sẽ báo
            lại cho bạn. Cách tự huỷ đơn và đổi trả xem ở{" "}
            <PolicyLink href="/chinh-sach-doi-tra-bao-hanh">Chính sách đổi trả &amp; bảo hành</PolicyLink>.
          </li>
          <li>
            Mỗi đơn áp dụng tối đa một mã giảm giá; điều kiện, thời hạn và mức giảm tối đa ghi ở từng mã và được kiểm tra lại
            khi đặt hàng.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="3. Đánh giá sản phẩm">
        <PolicyList>
          <li>Chỉ khách đã nhận hàng (đơn ở trạng thái “Đã giao hàng”) mới đánh giá được sản phẩm trong đơn đó.</li>
          <li>Đánh giá được cửa hàng duyệt trước khi hiện công khai, kèm tên người đánh giá; cửa hàng có thể trả lời công khai.</li>
          <li>
            Không đăng nội dung xúc phạm, quảng cáo, sai sự thật hoặc thông tin cá nhân của người khác — PCZone có quyền từ chối
            hoặc xoá những đánh giá như vậy.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="4. Trợ lý AI và AI gợi ý cấu hình">
        <PolicyList>
          <li>
            Câu trả lời và cấu hình do AI gợi ý chỉ mang tính tham khảo, có thể chưa chính xác hoặc chưa đầy đủ. AI chỉ nhắc tới
            sản phẩm đang bán tại PCZone; giá và tồn kho lấy theo dữ liệu tại thời điểm trả lời.
          </li>
          <li>
            Cấu hình AI gợi ý đã được hệ thống kiểm tra tương thích bằng bộ luật cố định (socket, loại RAM, công suất nguồn,
            kích thước vỏ...), nhưng bạn nên xem lại hoặc hỏi nhân viên trước khi mua.
          </li>
          <li>Đừng nhập thông tin cá nhân (mật khẩu, số tài khoản, địa chỉ...) vào khung chat hay ô mô tả nhu cầu.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="5. Hành vi bị cấm">
        <PolicyList>
          <li>Truy cập trái phép, dò mật khẩu, tìm cách vượt qua phân quyền của hệ thống.</li>
          <li>Dùng công cụ tự động gửi yêu cầu hàng loạt gây quá tải, hoặc sao chép dữ liệu website hàng loạt.</li>
          <li>Đặt hàng giả mạo hoặc dùng thông tin của người khác.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="6. Liên hệ và thay đổi điều khoản">
        <p>
          Thắc mắc về điều khoản: tổng đài <strong>{store.hotline}</strong> hoặc email{" "}
          <PolicyLink href={`mailto:${store.supportEmail}`}>{store.supportEmail}</PolicyLink>. Khi điều khoản thay đổi, PCZone
          cập nhật tại trang này kèm ngày cập nhật ở đầu trang.
        </p>
      </PolicySection>
    </PolicyArticle>
  );
}
