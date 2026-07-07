"use client";

import dynamic from "next/dynamic";

const AuthPage = dynamic(() => import("@/frontend/pages/auth/AuthPage"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#f4f2ec]" />,
});

export default function AuthClient() {
  return <AuthPage />;
}
