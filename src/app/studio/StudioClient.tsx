"use client";

import dynamic from "next/dynamic";

const StudioPage = dynamic(() => import("@/frontend/pages/studio/StudioPage"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#e7e9e8]" />,
});

export default function StudioClient() {
  return <StudioPage />;
}
