import type { Metadata } from "next";
import { Truck } from "lucide-react";
import PolicyArticle, { PolicyLink, PolicyList, PolicySection } from "@/components/policy/PolicyArticle";
import { getPublicSettings } from "@/lib/api";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Chính sách vận chuyển & thanh toán | PCZone",
  description: "Phí vận chuyển, cách theo dõi đơn hàng và các phương thức thanh toán đang áp dụng tại PCZone.",
};

/**
 * Phí vận chuyển và phương thức thanh toán lấy thẳng từ Cài đặt hệ thống (`/admin/settings`) — chủ website đổi số là
 * trang này đổi theo, không viết cứng con số nào. Phương thức chưa cấu hình hoặc đang tắt thì không liệt kê.
 */
export default async function ShippingPaymentPolicyPage() {
  const { shipping, payments } = await getPublicSettings();

  return (
    <PolicyArticle
      icon={Truck}
      title="Chính sách vận chuyển & thanh toán"
      href="/chinh-sach-van-chuyen-thanh-toan"
      intro={<p>Phí vận chuyển, cách theo dõi đơn hàng và các phương thức thanh toán PCZone đang nhận.</p>}
    >
      <PolicySection title="1. Phí vận chuyển">
        <PolicyList>
          {shipping.flatFee === 0 ? (
            <li>Miễn phí vận chuyển cho mọi đơn hàng.</li>
          ) : (
            <>
              <li>
                Đồng giá <strong>{formatPrice(shipping.flatFee)}</strong> cho mỗi đơn hàng.
              </li>
              <li>
                Miễn phí vận chuyển cho đơn có tổng tiền hàng (trước khi trừ mã giảm giá) từ{" "}
                <strong>{formatPrice(shipping.freeThreshold)}</strong>.
              </li>
            </>
          )}
          <li>Phí được hiện trước ở giỏ hàng và bước đặt hàng, rồi được hệ thống tính lại đúng lúc tạo đơn.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="2. Theo dõi đơn hàng">
        <PolicyList>
          <li>
            Mỗi đơn đi qua 5 bước: Đặt hàng → Đã xác nhận → Đang đóng gói → Đang giao hàng → Đã giao hàng, có ghi thời điểm
            từng bước ở trang <PolicyLink href="/tai-khoan/don-hang">Đơn hàng của tôi</PolicyLink>.
          </li>
          <li>Mã vận đơn hiện trong trang chi tiết đơn khi cửa hàng bàn giao hàng cho đơn vị vận chuyển.</li>
          <li>
            Không cần đăng nhập vẫn tra cứu được đơn ở trang{" "}
            <PolicyLink href="/tra-cuu-don-hang">Tra cứu đơn hàng</PolicyLink>, bằng mã đơn và số điện thoại người nhận.
          </li>
          <li>Thời gian giao phụ thuộc địa chỉ nhận hàng và đơn vị vận chuyển.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="3. Phương thức thanh toán">
        <PolicyList>
          {payments.cod ? <li><strong>Thanh toán khi nhận hàng (COD):</strong> trả tiền mặt cho nhân viên giao hàng.</li> : null}
          {payments.bankTransfer ? (
            <li>
              <strong>Chuyển khoản ngân hàng:</strong> sau khi đặt, trang đơn hiện mã QR đã điền sẵn số tiền và nội dung chuyển
              khoản (mã đơn). Nhân viên đối chiếu và xác nhận thủ công khi nhận được tiền, nên có thể mất một khoảng thời gian.
            </li>
          ) : null}
          {payments.momo ? (
            <li>
              <strong>Ví MoMo:</strong> chuyển tới số MoMo hiện ở trang đơn, lời nhắn là mã đơn; nhân viên xác nhận thủ công khi
              nhận được tiền.
            </li>
          ) : null}
          {payments.vnpay ? (
            <li>
              <strong>VNPay:</strong> thanh toán bằng thẻ ATM nội địa hoặc Visa/Master trên cổng VNPay; đơn tự chuyển sang
              “Đã xác nhận” khi thanh toán thành công.
            </li>
          ) : null}
        </PolicyList>
        <p>
          Huỷ đơn, hoàn tiền: xem <PolicyLink href="/chinh-sach-doi-tra-bao-hanh">Chính sách đổi trả &amp; bảo hành</PolicyLink>.
        </p>
      </PolicySection>
    </PolicyArticle>
  );
}
