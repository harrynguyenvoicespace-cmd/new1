"use client";

import dynamic from "next/dynamic";

const ProfilePage = dynamic(() => import("@/frontend/pages/profile/ProfilePage"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#f3f2ee]" />,
});

export default function ProfileClient() {
  return <ProfilePage />;
}
