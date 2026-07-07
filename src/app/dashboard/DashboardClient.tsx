"use client";

import dynamic from "next/dynamic";

const AppDashboard = dynamic(() => import("@/frontend/pages/dashboard/AppDashboard"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#f4f2ec]" />,
});

export default function DashboardClient() {
  return <AppDashboard />;
}
