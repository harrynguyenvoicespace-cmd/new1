"use client";

import dynamic from "next/dynamic";

const LoginPage = dynamic(() => import("@/frontend/pages/login/LoginPage"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#f4f2ec]" />,
});

export default function LoginClient() {
  return <LoginPage />;
}
