"use client";

import dynamic from "next/dynamic";

const LandingPage = dynamic(() => import("@/frontend/pages/home/LandingPage"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-background" />,
});

export default function HomeClient() {
  return <LandingPage />;
}
