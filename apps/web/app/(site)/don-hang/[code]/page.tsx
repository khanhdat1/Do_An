import type { Metadata } from "next";
import OrderPageView from "@/components/orders/OrderPageView";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pay?: string; reason?: string }>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Đơn hàng ${code} | PCZone`,
    // Trang riêng tư của từng tài khoản, không phải nội dung công khai
    robots: { index: false, follow: false },
  };
}

export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { pay, reason } = await searchParams;

  return (
    <div className="container-page py-8">
      <OrderPageView
        orderCode={code}
        paymentResult={pay === "success" || pay === "failed" ? pay : undefined}
        paymentReason={reason}
      />
    </div>
  );
}
