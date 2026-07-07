"use client";

import dynamic from "next/dynamic";

const PaymentPage = dynamic(() => import("@/frontend/pages/payment-page/PaymentPage"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#f8f7f4]" />,
});

export default function PaymentClient() {
  return <PaymentPage />;
}
