import { Resend } from "resend";
import { env } from "../env.js";

let client: Resend | null = null;
function resendClient(): Resend {
  client ??= new Resend(env.email.resendApiKey);
  return client;
}

/**
 * Gửi một email giao dịch. Thiếu `RESEND_API_KEY` thì KHÔNG lỗi — in link ra console server thay
 * vào đó, để luồng vẫn kiểm thử được ở máy chưa cấu hình (cùng nguyên tắc với
 * `isBankTransferConfigured`/VNPay: thiếu cấu hình không được làm hỏng phần còn lại của hệ thống).
 */
async function sendTransactionalEmail(options: {
  to: string;
  subject: string;
  html: string;
  consoleFallbackLabel: string;
  link: string;
}): Promise<void> {
  if (!env.email.resendApiKey) {
    console.log(`\n✉ [email chưa cấu hình] ${options.consoleFallbackLabel} cho ${options.to}:\n  ${options.link}\n`);
    return;
  }

  const { error } = await resendClient().emails.send({
    from: env.email.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  // Resend trả lỗi trong body thay vì ném exception — phải tự kiểm tra rồi mới coi là gửi xong
  if (error) throw new Error(`Gửi email thất bại: ${error.message}`);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendTransactionalEmail({
    to,
    subject: "Đặt lại mật khẩu PCZone",
    consoleFallbackLabel: "Link đặt lại mật khẩu",
    link: resetUrl,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #ea580c;">Đặt lại mật khẩu PCZone</h2>
        <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản PCZone dùng email này.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #ea580c; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Đặt lại mật khẩu
          </a>
        </p>
        <p>Liên kết có hiệu lực trong 30 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>
        <p style="color: #64748b; font-size: 13px;">Không bấm được nút trên? Dán liên kết sau vào trình duyệt: ${resetUrl}</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await sendTransactionalEmail({
    to,
    subject: "Xác minh email PCZone",
    consoleFallbackLabel: "Link xác minh email",
    link: verifyUrl,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #ea580c;">Xác minh email PCZone</h2>
        <p>Bấm nút bên dưới để xác minh đây đúng là email của bạn.</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #ea580c; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Xác minh email
          </a>
        </p>
        <p>Liên kết có hiệu lực trong 24 giờ. Không cần làm gì nếu bạn không tạo tài khoản này.</p>
        <p style="color: #64748b; font-size: 13px;">Không bấm được nút trên? Dán liên kết sau vào trình duyệt: ${verifyUrl}</p>
      </div>
    `,
  });
}
