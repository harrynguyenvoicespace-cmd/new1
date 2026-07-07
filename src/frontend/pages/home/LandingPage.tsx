'use client';

import { useState, useEffect } from "react";
import type React from "react";
import { Logo } from "@/frontend/shared/brand/Logo";
import { Button, Card, CardContent } from "./components/ui";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Puzzle,
  ArrowRight,
  Zap,
  Star,
  ChevronUp,
  ChevronDown,
  Sparkles,
  PieChart,
  BarChart2,
  UserCheck,
} from "lucide-react";

const eventChill = "/landing/event-chill-code-workshop.jpg";
const eventHackathon = "/landing/event-hackathon-ai.jpg";
const eventJam = "/landing/event-late-night-jam.jpg";
const eventStartup = "/landing/event-startup-weekend.jpg";
const eventSummit = "/landing/event-vibe-coding-summit.jpg";
const avatarSarah = "/landing/avatar-sarah.jpg";
const avatarMarcus = "/landing/avatar-marcus.jpg";
const avatarPriya = "/landing/avatar-priya.jpg";


const features = [
  {
    title: "Pages in minutes",
    description: "Beautiful registration pages that make your event shine — no design skills needed.",
    illustrationColor: "bg-[hsl(340,75%,95%)]",
  },
  {
    title: "Understand everything",
    description: "Live dashboards that show where attendees come from, drop off, and convert.",
    illustrationColor: "bg-[hsl(170,60%,92%)]",
  },
  {
    title: "Integrate with everything",
    description: "Connect Zoom, HubSpot, Mailchimp, and 20+ tools in a few clicks.",
    illustrationColor: "bg-[hsl(45,90%,92%)]",
  },
  {
    title: "One hub for everyone",
    description: "Manage, message, and track every attendee from a single beautiful dashboard.",
    illustrationColor: "bg-[hsl(250,60%,94%)]",
  },
];

// Real avatar URLs
const AVATAR_URLS = [
  "https://i.pravatar.cc/150?img=1",
  "https://i.pravatar.cc/150?img=5",
  "https://i.pravatar.cc/150?img=8",
  "https://i.pravatar.cc/150?img=9",
  "https://i.pravatar.cc/150?img=12",
  "https://i.pravatar.cc/150?img=16",
];

// Logo URLs from CDN
const LOGO_URLS = [
  { src: "https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/slack-icon.svg", name: "Slack" },
  { src: "https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/zoom-icon.svg", name: "Zoom" },
  { src: "https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/hubspot.svg", name: "HubSpot" },
  { src: "https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/mailchimp-freddie.svg", name: "Mailchimp" },
  { src: "https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/google-calendar.svg", name: "Calendar" },
  { src: "https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/stripe.svg", name: "Stripe" },
];

type BentoAccents = { integrationCircle: string; attendeeBorder: string; analyticsBars: string; analyticsAccent: string; pageButton: string };

function IllustrationPages({ accents }: { accents: BentoAccents }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      <div className="w-[85%] bg-white/80 rounded-xl shadow-lg overflow-hidden">
        <img src={eventSummit} alt="Event page preview" className="w-full h-28 object-cover" />
        <div className="p-3 space-y-2.5">
          <h4 className="text-[11px] font-bold text-foreground truncate">Vibe coding summit 2026</h4>
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span>📅 Apr 19, 2026</span>
            <span>📍 San Francisco</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground w-12">Name</span>
              <div className="h-5 bg-muted rounded-md flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground w-12">Email</span>
              <div className="h-5 bg-muted rounded-md flex-1" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <div className="h-7 rounded-full flex-1 flex items-center justify-center" style={{ backgroundColor: accents.pageButton }}>
              <span className="text-[9px] text-white font-semibold">Register now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IllustrationAnalytics({ accents }: { accents: BentoAccents }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      <div className="w-[85%] bg-white/80 rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4" style={{ color: accents.analyticsAccent }} />
          <span className="text-[10px] font-bold" style={{ color: accents.analyticsAccent }}>Live</span>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accents.analyticsBars }} />
        </div>
        <div className="flex items-end gap-1.5 h-20">
          {[40, 65, 30, 55, 80, 45, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, backgroundColor: accents.analyticsBars }} />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <span key={d} className="text-[7px] text-muted-foreground flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function IllustrationIntegrations({ accents }: { accents: BentoAccents }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center z-10" style={{ backgroundColor: accents.integrationCircle }}>
        <Puzzle className="w-8 h-8 text-white" />
      </div>
      {LOGO_URLS.map((logo, i) => {
        const angle = (i * 60 - 90) * Math.PI / 180;
        const r = 85;
        return (
          <div key={i} className="absolute w-14 h-14 rounded-xl bg-white/80 shadow-md flex items-center justify-center" style={{ left: `calc(50% + ${Math.cos(angle) * r}px - 28px)`, top: `calc(50% + ${Math.sin(angle) * r}px - 28px)` }}>
            <img src={logo.src} alt={logo.name} className="w-8 h-8" />
          </div>
        );
      })}
    </div>
  );
}

function IllustrationAttendees({ accents }: { accents: BentoAccents }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6">
      <div className="grid grid-cols-3 gap-4">
        {AVATAR_URLS.map((url, i) => (
          <div key={i} className="w-16 h-16 rounded-full overflow-hidden shadow-md border-[3px]" style={{ borderColor: accents.attendeeBorder }}>
            <img src={url} alt={`Attendee ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

const ILLUSTRATIONS = [IllustrationPages, IllustrationAnalytics, IllustrationIntegrations, IllustrationAttendees];

const rotatingWords = ["events.", "experiences.", "communities.", "connections."];

const fontWeightOptions = [
  { label: "Medium (500)", value: 500 },
  { label: "Semibold (600)", value: 600 },
  { label: "Bold (700)", value: 700 },
  { label: "Extrabold (800)", value: 800 },
];

const CONFETTI_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF6BCB", "#FF9F43"];
const CONFETTI_SHAPES = ["circle", "square", "triangle", "line"] as const;

// Seeded positions for each corner cluster
const cornerSeeds = [
  // top-left
  [
    { x: -40, y: -20, shape: 0, color: 0, rot: 12, baseSize: 12 },
    { x: 220, y: -30, shape: 1, color: 1, rot: 45, baseSize: 8 },
    { x: -25, y: 200, shape: 2, color: 2, rot: -20, baseSize: 14 },
    { x: 240, y: 50, shape: 0, color: 3, rot: 0, baseSize: 5 },
    { x: -30, y: 100, shape: 3, color: 4, rot: 30, baseSize: 10 },
    { x: 200, y: 200, shape: 1, color: 1, rot: 15, baseSize: 6 },
    { x: 100, y: -35, shape: 0, color: 5, rot: 0, baseSize: 7 },
    { x: -45, y: 150, shape: 2, color: 0, rot: 55, baseSize: 9 },
  ],
  // bottom-left
  [
    { x: 230, y: -20, shape: 1, color: 1, rot: 22, baseSize: 7 },
    { x: -35, y: 40, shape: 2, color: 3, rot: 15, baseSize: 12 },
    { x: 40, y: -30, shape: 0, color: 0, rot: 0, baseSize: 10 },
    { x: 220, y: 190, shape: 3, color: 2, rot: -40, baseSize: 10 },
    { x: -20, y: 200, shape: 1, color: 4, rot: 60, baseSize: 6 },
    { x: 150, y: -40, shape: 0, color: 5, rot: 0, baseSize: 8 },
    { x: -50, y: 120, shape: 2, color: 1, rot: 35, baseSize: 11 },
    { x: 250, y: 80, shape: 3, color: 0, rot: -15, baseSize: 9 },
  ],
  // top-right
  [
    { x: 230, y: -25, shape: 0, color: 4, rot: 0, baseSize: 10 },
    { x: -35, y: 70, shape: 1, color: 1, rot: 35, baseSize: 7 },
    { x: 40, y: -30, shape: 2, color: 2, rot: 40, baseSize: 13 },
    { x: 240, y: 180, shape: 0, color: 3, rot: 0, baseSize: 5 },
    { x: -25, y: 190, shape: 3, color: 0, rot: -25, baseSize: 10 },
    { x: 100, y: -40, shape: 1, color: 5, rot: 20, baseSize: 8 },
    { x: -50, y: 140, shape: 0, color: 4, rot: 0, baseSize: 6 },
    { x: 250, y: 60, shape: 2, color: 2, rot: -50, baseSize: 11 },
  ],
  // bottom-right
  [
    { x: -40, y: 30, shape: 1, color: 3, rot: 18, baseSize: 8 },
    { x: 230, y: -25, shape: 2, color: 1, rot: -30, baseSize: 14 },
    { x: 50, y: 200, shape: 0, color: 4, rot: 0, baseSize: 8 },
    { x: 240, y: 100, shape: 3, color: 2, rot: 50, baseSize: 10 },
    { x: 20, y: -30, shape: 0, color: 0, rot: 0, baseSize: 6 },
    { x: -30, y: 160, shape: 1, color: 5, rot: -40, baseSize: 7 },
    { x: 180, y: -45, shape: 2, color: 3, rot: 25, baseSize: 10 },
    { x: -45, y: 90, shape: 0, color: 1, rot: 0, baseSize: 9 },
  ],
];

function ConfettiLayer({ size, opacity, count, spread }: { size: number; opacity: number; count: number; spread: number }) {
  const corners = [
    { side: "left" as const, vSide: "top" as const, originX: 105, originY: 95 },
    { side: "left" as const, vSide: "bottom" as const, originX: 95, originY: -95 },
    { side: "right" as const, vSide: "top" as const, originX: -105, originY: 95 },
    { side: "right" as const, vSide: "bottom" as const, originX: -105, originY: -95 },
  ];

  return (
    <div className="hidden md:block absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
      {corners.map((corner, ci) =>
        cornerSeeds[ci].slice(0, count).map((seed, si) => {
          const s = seed.baseSize * size;
          const finalX = seed.x * spread;
          const finalY = seed.y * spread;
          const color = CONFETTI_COLORS[seed.color % CONFETTI_COLORS.length];
          const shape = CONFETTI_SHAPES[seed.shape % CONFETTI_SHAPES.length];

          const sharedMotion: any = {
            initial: {
              [corner.side]: corner.originX,
              [corner.vSide]: Math.abs(corner.originY),
              opacity: 0,
              scale: 0,
              rotate: 0,
            },
            animate: {
              [corner.side]: finalX,
              [corner.vSide]: finalY < 0 ? Math.abs(finalY) : finalY,
              opacity,
              scale: 1,
              rotate: seed.rot,
            },
            transition: {
              delay: 0.8 + si * 0.06 + ci * 0.04,
              duration: 0.5,
              type: "spring" as const,
              stiffness: 200,
              damping: 15,
            },
          };

          const posStyle: React.CSSProperties = { position: "absolute" };

          if (shape === "circle") {
            return <motion.div key={`${ci}-${si}`} {...sharedMotion} style={{ ...posStyle, width: s, height: s, borderRadius: "50%", backgroundColor: color }} />;
          }
          if (shape === "square") {
            return <motion.div key={`${ci}-${si}`} {...sharedMotion} style={{ ...posStyle, width: s, height: s, borderRadius: 2, backgroundColor: color }} />;
          }
          if (shape === "line") {
            return <motion.div key={`${ci}-${si}`} {...sharedMotion} style={{ ...posStyle, width: s, height: s * 0.25, borderRadius: 99, backgroundColor: color }} />;
          }
          // triangle
          const half = s / 2;
          return (
            <motion.div
              key={`${ci}-${si}`}
              {...sharedMotion}
              style={{
                ...posStyle,
                width: 0,
                height: 0,
                borderLeft: `${half}px solid transparent`,
                borderRight: `${half}px solid transparent`,
                borderBottom: `${s * 0.85}px solid ${color}`,
                backgroundColor: "transparent",
              }}
            />
          );
        })
      )}
    </div>
  );
}

const Landing = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [navVisible, setNavVisible] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [titleWeight, setTitleWeight] = useState(700);
  const [confettiSize, setConfettiSize] = useState(2.5);
  const [confettiOpacity, setConfettiOpacity] = useState(0.8);
  const [confettiCount, setConfettiCount] = useState(8);
  const [confettiSpread, setConfettiSpread] = useState(1.0);
  const [bentoStyle, setBentoStyle] = useState(0);

  // Bento color presets
  const bentoPresets = [
    {
      label: "Playful",
      cardBg: "bg-muted/50",
      colors: ["bg-[hsl(340,75%,95%)]", "bg-[hsl(170,60%,92%)]", "bg-[hsl(45,90%,92%)]", "bg-[hsl(250,60%,94%)]"],
      accents: { integrationCircle: "hsl(45,80%,45%)", attendeeBorder: "hsl(250,60%,80%)", analyticsBars: "hsl(170,60%,50%)", analyticsAccent: "hsl(170,60%,40%)", pageButton: "hsl(340,75%,58%)" },
    },
    {
      label: "Neutral",
      cardBg: "bg-background",
      colors: ["bg-background", "bg-background", "bg-background", "bg-background"],
      accents: { integrationCircle: "hsl(45,90%,50%)", attendeeBorder: "hsl(250,65%,65%)", analyticsBars: "hsl(170,65%,45%)", analyticsAccent: "hsl(170,65%,35%)", pageButton: "hsl(340,80%,55%)" },
    },
    {
      label: "Vivid",
      cardBg: "bg-muted/50",
      colors: ["bg-[hsl(340,75%,90%)]", "bg-[hsl(170,60%,86%)]", "bg-[hsl(45,90%,86%)]", "bg-[hsl(250,60%,90%)]"],
      accents: { integrationCircle: "hsl(45,90%,50%)", attendeeBorder: "hsl(250,65%,65%)", analyticsBars: "hsl(170,65%,45%)", analyticsAccent: "hsl(170,65%,35%)", pageButton: "hsl(340,80%,55%)" },
    },
  ];
  const currentPreset = bentoPresets[bentoStyle] ?? bentoPresets[0];

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setNavVisible(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Apply title weight globally
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,.font-display").forEach((el) => {
      el.style.fontWeight = String(titleWeight);
    });
  }, [titleWeight]);

  return (
    <div className="landing-exact min-h-screen bg-background overflow-x-hidden">
      {/* Navbar — hidden until scroll */}
      <motion.nav
        className="fixed top-0 w-full z-50 bg-background/90 backdrop-blur-md"
        initial={{ y: -100 }}
        animate={{ y: navVisible ? 0 : -100 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-[72px] px-6 lg:px-8">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-sm font-medium" asChild>
              <Link href="/dashboard">Log in</Link>
            </Button>
            <Button className="hidden sm:inline-flex text-sm font-semibold" asChild>
              <Link href="/dashboard">Sign up</Link>
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <div className="relative min-h-[580px] flex items-center justify-center">

            {/* Confetti shapes behind cards — dynamic */}
            <ConfettiLayer size={confettiSize} opacity={confettiOpacity} count={confettiCount} spread={confettiSpread} />
            {/* Top-left card */}
            <motion.div
              className="hidden md:block absolute left-[-100px] lg:left-[-40px] top-[20px] w-[200px] lg:w-[260px]"
              initial={{ opacity: 0, scale: 0.3, x: -80, y: -60 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-lg rotate-[6deg]">
                <img src={eventChill} alt="Chill code workshop" className="w-full h-[150px] object-cover" />
                <div className="bg-card px-3 py-2">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Workshop</span>
                </div>
              </div>
            </motion.div>

            {/* Bottom-left card */}
            <motion.div
              className="hidden md:block absolute left-[-120px] lg:left-[-60px] bottom-[20px] w-[200px] lg:w-[260px]"
              initial={{ opacity: 0, scale: 0.3, x: -80, y: 60 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.35 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-lg rotate-[-5deg]">
                <img src={eventJam} alt="Late night jam" className="w-full h-[150px] object-cover" />
                <div className="bg-card px-3 py-2">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Social</span>
                </div>
              </div>
            </motion.div>

            {/* Top-right card */}
            <motion.div
              className="hidden md:block absolute right-[-100px] lg:right-[-40px] top-[20px] w-[200px] lg:w-[260px]"
              initial={{ opacity: 0, scale: 0.3, x: 80, y: -60 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.25 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-lg rotate-[-6deg]">
                <img src={eventStartup} alt="Startup weekend" className="w-full h-[150px] object-cover" />
                <div className="bg-card px-3 py-2">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Hackathon</span>
                </div>
              </div>
            </motion.div>

            {/* Bottom-right card */}
            <motion.div
              className="hidden md:block absolute right-[-120px] lg:right-[-60px] bottom-[20px] w-[200px] lg:w-[260px]"
              initial={{ opacity: 0, scale: 0.3, x: 80, y: 60 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-lg rotate-[5deg]">
                <img src={eventSummit} alt="Vibe coding summit" className="w-full h-[150px] object-cover" />
                <div className="bg-card px-3 py-2">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Conference</span>
                </div>
              </div>
            </motion.div>

            {/* Center — headline */}
            <motion.div
              className="text-center max-w-2xl mx-auto relative z-10"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="flex items-center justify-center mb-6">
                <Logo size="lg" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[44px] 2xl:text-[56px] font-display tracking-tight leading-[1.15] text-foreground mb-6" style={{ fontWeight: titleWeight }}>
                The event platform
                <br />
                where ideas become{" "}
                <span className="inline-block relative" style={{ minWidth: "7ch" }}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={rotatingWords[wordIndex]}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.35 }}
                      className="text-foreground inline-block"
                    >
                      {rotatingWords[wordIndex]}
                    </motion.span>
                  </AnimatePresence>
                  {/* Invisible longest word to reserve space */}
                  <span className="invisible block h-0 overflow-hidden" aria-hidden="true">communities.</span>
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
                Whatever your event — from workshops to conferences — build branded
                registration pages, track attendees, and grow your community. No code required.
              </p>
              <Button size="lg" className="text-base font-semibold px-8 h-12" asChild>
                <Link href="/dashboard">Get started <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Upcoming events showcase */}
      <section className="py-12 lg:py-16 pb-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl sm:text-3xl font-display text-foreground tracking-[-0.02em]" style={{ fontWeight: titleWeight }}>
              Popular events on eventspark
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { img: eventHackathon, title: "AI hackathon", tag: "Free", date: "Sat, Mar 28" },
              { img: eventChill, title: "Chill code workshop", tag: "Free", date: "Thu, Apr 3" },
              { img: eventStartup, title: "Startup weekend", tag: "$25", date: "Fri, Apr 11" },
              { img: eventSummit, title: "Vibe coding summit", tag: "Free", date: "Sat, Apr 19" },
            ].map((event, i) => (
              <motion.div
                key={event.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="group cursor-pointer">
                  <div className="relative rounded-xl overflow-hidden mb-3">
                    <img
                      src={event.img}
                      alt={event.title}
                      className="w-full h-[180px] object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 bg-card text-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                      {event.tag}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{event.date}</p>
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors tracking-[-0.01em]">{event.title}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28 bg-card">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-display mb-4 text-foreground tracking-[-0.02em]" style={{ fontWeight: titleWeight }}>
              Everything you need to run amazing events
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From page creation to post-event analytics, eventspark has you covered.
            </p>
          </motion.div>

          {/* Bento grid — 2 equal top, wider+narrower bottom */}
          <div className="space-y-6">
            {/* Top row — 2 equal cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.slice(0, 2).map((feature, i) => {
                const Illust = ILLUSTRATIONS[i];
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <div className={`h-full rounded-3xl overflow-hidden ${currentPreset.cardBg} flex flex-col`}>
                      <div className={`${currentPreset.colors[i]} aspect-[4/3] flex items-center justify-center`}>
                        <Illust accents={currentPreset.accents} />
                      </div>
                      <div className="p-6">
                        <h3 className="font-display font-bold text-xl mb-2 text-foreground tracking-[-0.01em]">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {/* Bottom row — wider left, narrower right, equal height */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {features.slice(2).map((feature, rawI) => {
                const i = rawI + 2;
                const Illust = ILLUSTRATIONS[i];
                const isWide = rawI === 0;
                return (
                  <motion.div
                    key={feature.title}
                    className={isWide ? "md:col-span-3" : "md:col-span-2"}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <div className={`h-full rounded-3xl overflow-hidden ${currentPreset.cardBg} flex ${isWide ? "flex-col sm:flex-row" : "flex-col"}`}>
                      <div className={`${currentPreset.colors[i]} ${isWide ? "sm:w-1/2 aspect-[4/3] sm:aspect-auto" : "aspect-[4/3]"} flex items-center justify-center relative flex-shrink-0`}>
                        <Illust accents={currentPreset.accents} />
                      </div>
                      <div className="p-6 flex flex-col justify-center">
                        <h3 className="font-display font-bold text-xl mb-2 text-foreground tracking-[-0.01em]">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-display mb-4 text-foreground tracking-[-0.02em]" style={{ fontWeight: titleWeight }}>
              Loved by organizers
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              {
                quote: "eventspark cut our setup time by 80%. We went from spending hours on registration to minutes.",
                name: "Sarah Chen",
                role: "Community manager",
                avatar: avatarSarah,
              },
              {
                quote: "The analytics alone are worth it. We finally know where our attendees are coming from.",
                name: "Marcus Williams",
                role: "Event coordinator",
                avatar: avatarMarcus,
              },
              {
                quote: "Clean, professional, and easy to use. Our attendees always compliment the registration experience.",
                name: "Priya Patel",
                role: "Startup founder",
                avatar: avatarPriya,
              },
              {
                quote: "We switched from three different tools to just eventspark. Everything in one place is a game changer.",
                name: "James Liu",
                role: "Tech meetup organizer",
                avatar: "https://i.pravatar.cc/300?img=33",
              },
              {
                quote: "Our registrations doubled after switching. The pages just look so much more professional.",
                name: "Amara Osei",
                role: "Conference director",
                avatar: "https://i.pravatar.cc/300?img=47",
              },
            ].map((testimonial, i) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="h-full border-0 shadow-sm overflow-hidden rounded-2xl">
                  <div className="h-[180px] overflow-hidden">
                    <img src={testimonial.avatar} alt={testimonial.name} className="w-full h-full object-cover object-center" />
                  </div>
                  <CardContent className="p-6">
                    <div className="flex gap-0.5 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-foreground text-sm leading-relaxed mb-5">"{testimonial.quote}"</p>
                    <div>
                      <p className="font-display font-semibold text-sm text-foreground">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pt-10 lg:pt-16 pb-12 lg:pb-16 relative">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="relative pt-20 lg:pt-24">
            <div className="absolute inset-x-0 top-0 z-20 flex justify-center pointer-events-none" aria-hidden="true">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.85 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, type: "spring", stiffness: 220, damping: 18 }}
                className="drop-shadow-[0_18px_40px_hsl(240_30%_14%_/_0.18)]"
              >
                <svg width="130" height="158" viewBox="0 0 130 158" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Calendar body */}
                  <rect x="10" y="28" width="110" height="120" rx="16" fill="hsl(var(--card))" />
                  {/* Header bar */}
                  <rect x="10" y="28" width="110" height="32" rx="16" fill="hsl(var(--primary))" />
                  <rect x="10" y="44" width="110" height="16" fill="hsl(var(--primary))" />
                  {/* Binding rings */}
                  <rect x="38" y="14" width="10" height="28" rx="5" fill="hsl(var(--foreground))" />
                  <rect x="82" y="14" width="10" height="28" rx="5" fill="hsl(var(--foreground))" />
                  {/* Day grid - 5 cols x 4 rows, centered */}
                  {[0, 1, 2, 3, 4].map((col) =>
                    [0, 1, 2, 3].map((row) => (
                      <rect
                        key={`${col}-${row}`}
                        x={21 + col * 19}
                        y={72 + row * 18}
                        width="12"
                        height="10"
                        rx="2.5"
                        fill={col === 3 && row === 2 ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      />
                    )),
                  )}
                  {/* Checkmark on highlighted day */}
                  <path d="M75 100L78 103L84 96" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            </div>

            <div className="bg-foreground rounded-[2rem] relative overflow-hidden px-6 pt-24 pb-20 lg:px-10 lg:pt-28 lg:pb-24">
              <div className="absolute inset-x-0 top-5 flex justify-center pointer-events-none" aria-hidden="true">
                {[
                  { x: -110, y: 20, size: 14, color: "hsl(2 100% 70%)", shape: "circle", rot: 0 },
                  { x: -72, y: 42, size: 10, color: "hsl(48 100% 62%)", shape: "square", rot: 35 },
                  { x: -38, y: 12, size: 16, color: "hsl(122 48% 61%)", shape: "circle", rot: 0 },
                  { x: -18, y: 48, size: 8, color: "hsl(217 90% 63%)", shape: "square", rot: -20 },
                  { x: 0, y: 10, size: 12, color: "hsl(319 84% 69%)", shape: "triangle", rot: 15 },
                  { x: 22, y: 46, size: 10, color: "hsl(31 100% 63%)", shape: "circle", rot: 0 },
                  { x: 56, y: 14, size: 14, color: "hsl(48 100% 62%)", shape: "square", rot: 50 },
                  { x: 78, y: 38, size: 8, color: "hsl(2 100% 70%)", shape: "circle", rot: 0 },
                  { x: 104, y: 20, size: 12, color: "hsl(122 48% 61%)", shape: "triangle", rot: -30 },
                  { x: -132, y: 54, size: 6, color: "hsl(217 90% 63%)", shape: "circle", rot: 0 },
                  { x: 126, y: 48, size: 10, color: "hsl(319 84% 69%)", shape: "square", rot: 22 },
                  { x: -146, y: 28, size: 8, color: "hsl(31 100% 63%)", shape: "triangle", rot: 40 },
                  { x: 146, y: 24, size: 12, color: "hsl(48 100% 62%)", shape: "circle", rot: 0 },
                  { x: -54, y: 58, size: 6, color: "hsl(122 48% 61%)", shape: "square", rot: -45 },
                ].map((p, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{ left: `calc(50% + ${p.x}px)`, top: p.y }}
                    initial={{ opacity: 0, scale: 0, y: 30 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0, rotate: p.rot }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.04, duration: 0.5, type: "spring", stiffness: 250, damping: 15 }}
                  >
                    {p.shape === "circle" && (
                      <div style={{ width: p.size, height: p.size, borderRadius: "50%", backgroundColor: p.color }} />
                    )}
                    {p.shape === "square" && (
                      <div style={{ width: p.size, height: p.size, borderRadius: 2, backgroundColor: p.color }} />
                    )}
                    {p.shape === "triangle" && (
                      <div style={{ width: 0, height: 0, borderLeft: `${p.size / 2}px solid transparent`, borderRight: `${p.size / 2}px solid transparent`, borderBottom: `${p.size}px solid ${p.color}` }} />
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="text-center relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <h2 className="text-3xl sm:text-4xl font-display mb-4 text-background tracking-[-0.02em]" style={{ fontWeight: titleWeight }}>
                    Ready to create your next event?
                  </h2>
                  <p className="text-background/70 text-lg mb-8 max-w-lg mx-auto text-balance">
                    Join thousands of organizers who use eventspark to build better events.
                  </p>
                  <Button size="lg" className="text-base font-semibold px-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href="/dashboard">Get started for free <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo size="md" />
          <p className="text-sm text-muted-foreground">© 2026 eventspark. All rights reserved.</p>
        </div>
      </footer>

      {/* Dev picker */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[9999]">
        <button
          onClick={() => setDevOpen(!devOpen)}
          className="mx-auto flex items-center gap-1.5 bg-foreground text-background text-xs font-medium px-4 py-1.5 rounded-t-lg shadow-lg"
        >
          🎨 Dev tools {devOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        {devOpen && (
          <div className="bg-card border border-border rounded-t-xl shadow-2xl p-4 w-[340px] space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title font weight</label>
              <select
                value={titleWeight}
                onChange={(e) => setTitleWeight(Number(e.target.value))}
                className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 text-foreground"
              >
                {fontWeightOptions.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bento colour style</label>
              <div className="flex gap-1.5">
                {bentoPresets.map((preset, idx) => (
                  <button
                    key={preset.label}
                    onClick={() => setBentoStyle(idx)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${bentoStyle === idx ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-foreground hover:bg-muted"}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-muted-foreground">Confetti visible</span>
              <input type="checkbox" checked={confettiCount > 0} onChange={(e) => setConfettiCount(e.target.checked ? 6 : 0)} className="accent-primary w-4 h-4" />
            </label>
            <div className="border-t border-border pt-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">Confetti</label>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Size</span>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{confettiSize.toFixed(1)}</span>
                </div>
                <input type="range" min="0.3" max="2.5" step="0.1" value={confettiSize} onChange={(e) => setConfettiSize(Number(e.target.value))} className="w-full h-1.5 accent-primary" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Boldness</span>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{Math.round(confettiOpacity * 100)}%</span>
                </div>
                <input type="range" min="0.1" max="1" step="0.05" value={confettiOpacity} onChange={(e) => setConfettiOpacity(Number(e.target.value))} className="w-full h-1.5 accent-primary" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Amount</span>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{confettiCount}</span>
                </div>
                <input type="range" min="1" max="8" step="1" value={confettiCount} onChange={(e) => setConfettiCount(Number(e.target.value))} className="w-full h-1.5 accent-primary" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Spread</span>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{confettiSpread.toFixed(1)}</span>
                </div>
                <input type="range" min="0.5" max="2" step="0.1" value={confettiSpread} onChange={(e) => setConfettiSpread(Number(e.target.value))} className="w-full h-1.5 accent-primary" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Landing;
