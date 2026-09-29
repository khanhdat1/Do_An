import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import PolicyArticle, { PolicyLink, PolicyList, PolicySection } from "@/components/policy/PolicyArticle";
import { getPublicSettings } from "@/lib/api";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | PCZone",
  description:
    "PCZone thu thập những thông tin gì, dùng vào việc gì, chia sẻ với ai, lưu bao lâu và cách bạn yêu cầu sửa hoặc xoá dữ liệu.",
};

/**
 * Mô tả ĐÚNG những gì hệ thống đang làm (đối chiếu schema Prisma, cookie, dịch vụ bên ngoài trong apps/api) — sửa tính
 * năng có đụng tới dữ liệu cá nhân thì sửa trang này theo. Mục #xoa-du-lieu là "hướng dẫn xoá dữ liệu" khai cho Facebook.
 */
export default async function PrivacyPolicyPage() {
  const { store } = await getPublicSettings();
  const email = <PolicyLink href={`mailto:${store.supportEmail}`}>{store.supportEmail}</PolicyLink>;

  return (
    <PolicyArticle
      icon={ShieldCheck}
      title="Chính sách bảo mật"
      href="/chinh-sach-bao-mat"
      intro={
        <p>
          Trang này giải thích PCZone thu thập thông tin gì khi bạn dùng website, dùng vào việc gì, chia sẻ với ai và cách bạn
          yêu cầu sửa hoặc xoá dữ liệu của mình.
        </p>
      }
    >
      <PolicySection title="1. Thông tin được thu thập và mục đích">
        <PolicyList>
          <li>
            <strong>Tài khoản:</strong> họ tên, email, số điện thoại (không bắt buộc) — để đăng nhập, liên hệ về đơn hàng,
            gửi email xác minh tài khoản và đặt lại mật khẩu. Mật khẩu chỉ được lưu dưới dạng băm một chiều (bcrypt): không ai
            đọc lại được mật khẩu gốc, kể cả nhân viên PCZone.
          </li>
          <li>
            <strong>Đăng nhập bằng Google/Facebook</strong> (chỉ khi bạn chọn): mã định danh tài khoản bên đó, email, họ tên
            và ảnh đại diện. PCZone không nhận và không lưu mật khẩu Google/Facebook của bạn.
          </li>
          <li>
            <strong>Sổ địa chỉ và đơn hàng:</strong> tên người nhận, số điện thoại, địa chỉ giao hàng, sản phẩm, số tiền, mã
            giảm giá, ghi chú, lịch sử trạng thái và mã vận đơn — để xử lý, giao hàng, bảo hành và để bạn tra cứu lại.
          </li>
          <li>
            <strong>Hoạt động mua sắm:</strong> giỏ hàng, sản phẩm yêu thích, cấu hình Build PC đã lưu và đánh giá sản phẩm.
            Đánh giá được hiển thị công khai kèm tên của bạn sau khi được duyệt; cấu hình đã lưu có đường dẫn chia sẻ — ai có
            đường dẫn đều xem được.
          </li>
          <li>
            <strong>Trợ lý AI và tìm kiếm bằng AI:</strong> nội dung câu hỏi và câu trả lời được lưu để hiện lại lịch sử hội
            thoại và cải thiện kết quả tìm kiếm.
          </li>
          <li>
            <strong>Thông tin kỹ thuật:</strong> địa chỉ IP và thông tin trình duyệt của mỗi phiên đăng nhập — để bảo vệ tài
            khoản (thu hồi phiên, giới hạn số lần đăng nhập sai).
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="2. Thanh toán">
        <p>
          PCZone không nhận và không lưu số thẻ ngân hàng. Với chuyển khoản ngân hàng hoặc ví MoMo, bạn tự chuyển tiền trong
          ứng dụng của mình; mã QR chuyển khoản do dịch vụ VietQR (vietqr.io) tạo từ số tài khoản của cửa hàng, số tiền và mã
          đơn. Khi cửa hàng bật cổng thanh toán trực tuyến, thông tin thẻ được nhập trên trang của cổng thanh toán, không đi
          qua PCZone.
        </p>
      </PolicySection>

      <PolicySection title="3. Cookie và dữ liệu lưu trên trình duyệt">
        <PolicyList>
          <li>
            Cookie đăng nhập (JavaScript trên trang không đọc được), cookie giữ giỏ hàng và hội thoại với trợ lý AI khi bạn
            chưa đăng nhập.
          </li>
          <li>
            Danh sách so sánh sản phẩm và lịch sử tìm kiếm gần đây được lưu ngay trong trình duyệt của bạn, không gửi lên máy
            chủ.
          </li>
          <li>PCZone không dùng cookie quảng cáo hay công cụ theo dõi, phân tích hành vi của bên thứ ba.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="4. Chia sẻ thông tin với bên thứ ba">
        <p>PCZone không bán hay cho thuê dữ liệu cá nhân. Thông tin chỉ được chuyển cho các bên cần thiết để vận hành dịch vụ:</p>
        <PolicyList>
          <li>Đơn vị vận chuyển: tên, số điện thoại và địa chỉ người nhận để giao hàng.</li>
          <li>Google, Facebook: khi bạn chọn đăng nhập bằng tài khoản của họ.</li>
          <li>Resend (dịch vụ gửi email): địa chỉ email của bạn, khi hệ thống gửi email xác minh tài khoản hoặc đặt lại mật khẩu.</li>
          <li>
            Dịch vụ AI (hiện dùng Google Gemini): nội dung bạn gõ vào trợ lý AI, ô tìm kiếm bằng AI và phần mô tả nhu cầu khi
            nhờ AI gợi ý cấu hình, kèm thông tin sản phẩm liên quan của cửa hàng. Hệ thống không gửi kèm tên, email, địa chỉ
            hay đơn hàng của bạn — vì vậy đừng gõ thông tin cá nhân vào các khung này.
          </li>
          <li>VietQR: số tiền và mã đơn, khi hiển thị mã QR chuyển khoản.</li>
          <li>Cơ quan nhà nước có thẩm quyền, khi có yêu cầu theo quy định của pháp luật.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="5. Bảo vệ dữ liệu">
        <PolicyList>
          <li>
            Kết nối được mã hoá HTTPS; mật khẩu băm bằng bcrypt; cookie đăng nhập chỉ gửi qua HTTPS và JavaScript không đọc
            được.
          </li>
          <li>Giới hạn số lần đăng nhập sai và số yêu cầu liên tục để chống dò mật khẩu.</li>
          <li>
            Nhân viên quản trị chỉ thấy phần việc theo vai trò được phân quyền, có thể bật xác thực hai bước, và mọi thao tác
            quản trị đều được ghi nhật ký.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="6. Thời gian lưu trữ">
        <PolicyList>
          <li>
            Thông tin tài khoản, sổ địa chỉ, giỏ hàng, sản phẩm yêu thích, cấu hình đã lưu và hội thoại AI: lưu cho tới khi
            bạn xoá hoặc yêu cầu xoá tài khoản.
          </li>
          <li>Đơn hàng đã phát sinh: được giữ lại để đối soát, bảo hành và giải quyết khiếu nại.</li>
          <li>Phiên đăng nhập hết hạn sau tối đa 30 ngày.</li>
          <li>Liên kết đặt lại mật khẩu (30 phút) và xác minh email (24 giờ) chỉ dùng được một lần, trong thời hạn đó.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection id="xoa-du-lieu" title="7. Quyền của bạn và cách yêu cầu xoá dữ liệu">
        <PolicyList>
          <li>
            Xem và sửa họ tên, số điện thoại, sổ địa chỉ ở trang <PolicyLink href="/tai-khoan">Tài khoản</PolicyLink>.
          </li>
          <li>
            Huỷ liên kết Google/Facebook ở mục liên kết tài khoản trong trang Tài khoản; bạn cũng có thể gỡ quyền của PCZone
            trong phần cài đặt ứng dụng của Google hoặc Facebook.
          </li>
          <li>
            Yêu cầu xoá tài khoản và dữ liệu cá nhân: gửi email tới {email} từ chính địa chỉ email đã đăng ký, tiêu đề
            “Yêu cầu xoá tài khoản”. PCZone xoá tài khoản cùng dữ liệu cá nhân gắn với tài khoản và trả lời qua email; riêng
            thông tin đơn hàng đã phát sinh có thể được giữ lại như mục 6.
          </li>
        </PolicyList>
        <p>
          Tài khoản đăng nhập bằng Facebook làm tương tự: gỡ PCZone khỏi mục “Ứng dụng và trang web” trong cài đặt Facebook,
          rồi gửi email như trên để xoá dữ liệu PCZone đã nhận từ Facebook.
        </p>
      </PolicySection>

      <PolicySection title="8. Liên hệ và thay đổi chính sách">
        <p>
          Mọi câu hỏi về dữ liệu cá nhân: email {email} hoặc tổng đài <strong>{store.hotline}</strong>. Khi chính sách thay
          đổi, PCZone cập nhật tại trang này kèm ngày cập nhật ở đầu trang.
        </p>
      </PolicySection>
    </PolicyArticle>
  );
}
