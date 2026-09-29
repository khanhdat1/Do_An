import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import PolicyArticle, { PolicyLink, PolicyList, PolicySection } from "@/components/policy/PolicyArticle";
import { getPublicSettings } from "@/lib/api";

export const metadata: Metadata = {
  title: "Chính sách đổi trả & bảo hành | PCZone",
  description: "Thời hạn bảo hành, cách tự huỷ đơn, quy trình đổi trả và hoàn tiền tại PCZone.",
};

/**
 * Chỉ ghi đúng quy trình hệ thống đang hỗ trợ: khách tự huỷ khi đơn chưa thanh toán và chưa đóng gói, hoàn trả do nhân
 * viên xử lý (đơn chuyển "Đã hoàn trả", nhập lại kho), hoàn tiền thủ công rồi đánh dấu "Đã hoàn tiền". Thời hạn đổi trả
 * cụ thể là quyết định kinh doanh chưa được chốt nên không tự đặt con số.
 */
export default async function ReturnWarrantyPolicyPage() {
  const { store } = await getPublicSettings();
  const contact = (
    <>
      tổng đài <strong>{store.hotline}</strong> hoặc email{" "}
      <PolicyLink href={`mailto:${store.supportEmail}`}>{store.supportEmail}</PolicyLink>
    </>
  );

  return (
    <PolicyArticle
      icon={RotateCcw}
      title="Chính sách đổi trả & bảo hành"
      href="/chinh-sach-doi-tra-bao-hanh"
      intro={<p>Cách huỷ đơn, đổi trả, hoàn tiền và bảo hành sản phẩm mua tại PCZone.</p>}
    >
      <PolicySection title="1. Bảo hành">
        <PolicyList>
          <li>Thời hạn bảo hành của từng sản phẩm ghi ở dòng “Bảo hành” trên trang sản phẩm.</li>
          <li>
            Ngày nhận hàng — lúc đơn chuyển sang “Đã giao hàng” — được lưu trong lịch sử đơn (Tài khoản → Đơn hàng của tôi) và
            là căn cứ tính thời hạn bảo hành, bạn không cần giữ giấy tờ riêng.
          </li>
          <li>Khi cần bảo hành: liên hệ {contact}, kèm mã đơn và mô tả lỗi; PCZone sẽ hướng dẫn cách gửi sản phẩm.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="2. Tự huỷ đơn hàng">
        <PolicyList>
          <li>
            Bạn tự huỷ được ở trang chi tiết đơn khi đơn đang “Chờ xác nhận” hoặc “Đã xác nhận” và chưa thanh toán. Sản phẩm
            được trả lại kho ngay khi huỷ.
          </li>
          <li>Đơn đã thanh toán, đang đóng gói hoặc đang giao: liên hệ {contact} để được hỗ trợ.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="3. Đổi trả sau khi nhận hàng">
        <PolicyList>
          <li>
            Liên hệ {contact}, kèm mã đơn, lý do và tình trạng sản phẩm. PCZone kiểm tra và xác nhận từng trường hợp; điều
            kiện cụ thể (thời gian, tình trạng hộp và phụ kiện) được thông báo khi tiếp nhận yêu cầu.
          </li>
          <li>
            Khi yêu cầu được chấp nhận, đơn chuyển sang “Đã hoàn trả” — bạn xem được ngay trong trang đơn hàng của mình, kèm
            lịch sử từng bước.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="4. Hoàn tiền">
        <PolicyList>
          <li>
            Đơn đã thanh toán mà bị huỷ hoặc hoàn trả được hoàn tiền bằng chuyển khoản tới tài khoản bạn cung cấp. Sau khi
            chuyển, nhân viên đánh dấu “Đã hoàn tiền” và trạng thái thanh toán trên trang đơn cập nhật theo.
          </li>
          <li>Đơn thanh toán khi nhận hàng (COD) mà chưa trả tiền thì không phát sinh hoàn tiền.</li>
        </PolicyList>
        <p>
          Xem thêm <PolicyLink href="/chinh-sach-van-chuyen-thanh-toan">Chính sách vận chuyển &amp; thanh toán</PolicyLink>.
        </p>
      </PolicySection>
    </PolicyArticle>
  );
}
