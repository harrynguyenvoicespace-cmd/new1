export type AppRouteId = "landing" | "home" | "aiStudio" | "payment" | "login" | "profile";

export type AppRouteContract = {
  id: AppRouteId;
  label: string;
  href: string;
  icon: string;
};

export const appRoutes = {
  landing: { id: "landing", label: "Landing", href: "/", icon: "/bloxlab/logo-b.png" },
  home: { id: "home", label: "Home", href: "/dashboard", icon: "/bloxlab/icon-home.png" },
  aiStudio: { id: "aiStudio", label: "AI Studio", href: "/studio", icon: "/bloxlab/icon-studio.png" },
  payment: { id: "payment", label: "Payment", href: "/payment-page", icon: "/bloxlab/icon-template.png" },
  login: { id: "login", label: "Login", href: "/login", icon: "/bloxlab/icon-profile.png" },
  profile: { id: "profile", label: "Profile", href: "/profile", icon: "/bloxlab/icon-profile.png" },
} satisfies Record<AppRouteId, AppRouteContract>;

export const primaryNavigation = [
  appRoutes.landing,
  appRoutes.home,
  appRoutes.aiStudio,
  appRoutes.payment,
  appRoutes.login,
  appRoutes.profile,
] as const;
