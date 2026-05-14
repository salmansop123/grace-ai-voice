"use client";

import Link from "next/link";
import type { Route } from "next";
import { motion, type Variants } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BarChart3,
  Brain,
  Bot,
  CalendarClock,
  Check,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Mic2,
  PhoneCall,
  PhoneForwarded,
  PhoneOutgoing,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const easePremium = [0.22, 1, 0.36, 1] as const;

const fadeBlur = {
  initial: { opacity: 0, y: 32, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-72px", amount: 0.22 },
  transition: { duration: 0.7, ease: easePremium },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: easePremium },
  },
};

const staggerItemTight: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: easePremium },
  },
};

/** Nested list: propagate stagger to `motion.li` without fading the `<ul>` itself. */
const staggerList: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.02 },
  },
};

function GlassPanel({ className, children }: { className?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-sky-100/85 bg-white/95 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(37,99,235,0.035),0_12px_40px_-28px_rgba(30,58,138,0.09)] backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

const HERO_PARTICLE_SEED: ReadonlyArray<{ l: string; t: string; delay: string }> = [
  { l: "14%", t: "22%", delay: "0s" },
  { l: "78%", t: "30%", delay: "0.6s" },
  { l: "52%", t: "18%", delay: "1.1s" },
  { l: "88%", t: "62%", delay: "0.3s" },
  { l: "8%", t: "55%", delay: "1.4s" },
];

function HeroParticlesSmall(): JSX.Element {
  return (
    <>
      {HERO_PARTICLE_SEED.map((p, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-gradient-to-br from-blue-400/45 to-violet-400/35 shadow-[0_0_8px_rgba(59,130,246,0.25)] motion-reduce:opacity-25 animate-pulse-soft"
          style={{ left: p.l, top: p.t, animationDelay: p.delay }}
        />
      ))}
    </>
  );
}

function MiniSparklineDecor({ className, gradId }: { className?: string; gradId: string }): JSX.Element {
  return (
    <svg className={cn("overflow-visible", className)} viewBox="0 0 120 36" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#3b82f6" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#22d3ee" stopOpacity="0.85" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0 28 L12 24 L24 26 L38 14 L52 18 L68 8 L84 12 L100 4 L120 8"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.2, ease: easePremium, repeat: Infinity, repeatDelay: 3, repeatType: "mirror" }}
      />
    </svg>
  );
}

function HeroLiveRibbon(): JSX.Element {
  const barPx = [18, 28, 15, 34, 22, 26, 17];
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-3">
      <GlassPanel className="relative overflow-hidden border-sky-100/80 bg-gradient-to-b from-white/[0.97] via-white/92 to-sky-50/35 p-4 shadow-[0_12px_40px_-24px_rgba(37,99,235,0.16)] backdrop-blur-md ring-1 ring-white/70">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <Activity className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2} />
            Live sessions
          </span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200/80" />
          </span>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-900">847</p>
        <p className="text-[11px] text-slate-500">Active AI voice minutes (rolling)</p>
        <div className="mt-4 flex h-10 items-end justify-between gap-1 px-0.5">
          {barPx.map((px, i) => (
            <div
              key={i}
              aria-hidden
              className="w-1.5 origin-bottom rounded-full bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-400 motion-reduce:scale-y-75"
              style={{ height: px, animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="relative overflow-hidden border-sky-100/80 bg-gradient-to-b from-white/[0.97] via-white/92 to-violet-50/25 p-4 shadow-[0_12px_40px_-24px_rgba(124,58,237,0.12)] backdrop-blur-md ring-1 ring-white/70">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <BarChart3 className="h-3.5 w-3.5 text-violet-600" strokeWidth={2} />
            Throughput
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100/90">
            +12%
          </span>
        </div>
        <MiniSparklineDecor gradId="hero-spark-throughput" className="mt-3 h-9 w-full" />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Outbound contacts vs. prior week</p>
      </GlassPanel>

      <GlassPanel className="relative overflow-hidden border-sky-100/80 bg-gradient-to-b from-white/[0.97] via-white/92 to-cyan-50/20 p-4 shadow-[0_12px_40px_-24px_rgba(14,165,233,0.14)] backdrop-blur-md ring-1 ring-white/70">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <LayoutDashboard className="h-3.5 w-3.5 text-blue-600" strokeWidth={2} />
            Console
          </span>
          <span className="text-[10px] font-medium text-slate-400">Preview</span>
        </div>
        <div className="mt-3 space-y-2 rounded-lg border border-sky-100/80 bg-gradient-to-b from-white to-slate-50/90 p-2.5 shadow-inner">
          <div className="flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="h-1.5 w-[42%] rounded-full bg-gradient-to-r from-blue-200 to-cyan-200" />
          <div className="grid grid-cols-3 gap-1.5">
            <div className="h-8 rounded-md bg-blue-50/90 ring-1 ring-blue-100/70" />
            <div className="h-8 rounded-md bg-violet-50/90 ring-1 ring-violet-100/70" />
            <div className="h-8 rounded-md bg-teal-50/90 ring-1 ring-teal-100/70" />
          </div>
          <div className="h-1 w-full rounded-full bg-slate-100" />
          <div className="h-1 w-[80%] rounded-full bg-gradient-to-r from-violet-200/80 to-transparent" />
        </div>
      </GlassPanel>
    </div>
  );
}

/** Floating glass stack — desktop hero visual (matches website hero mock). */
function HeroAmbientStack(): JSX.Element {
  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[360px]" aria-hidden>
      <motion.div
        className="absolute left-2 top-6 w-[92%] rotate-[-5deg]"
        initial={{ opacity: 0, y: 20, rotate: -6 }}
        animate={{ opacity: 1, y: 0, rotate: -5 }}
        transition={{ duration: 0.75, ease: easePremium, delay: 0.25 }}
      >
        <GlassPanel className="border-violet-100/90 bg-gradient-to-b from-white/95 to-violet-50/20 p-4 shadow-[0_24px_56px_-28px_rgba(124,58,237,0.18)] backdrop-blur-md ring-1 ring-white/75">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Agents</span>
            <span className="text-violet-600">Live</span>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-14 flex-1 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50/80 ring-1 ring-sky-100/80" />
            <div className="h-14 flex-1 rounded-lg bg-gradient-to-br from-violet-50 to-fuchsia-50/70 ring-1 ring-violet-100/75" />
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <motion.div
              className="h-full w-[62%] rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400"
              animate={{ width: ["58%", "72%", "64%", "68%"] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute right-0 top-[38%] w-[88%] rotate-[4deg]"
        initial={{ opacity: 0, y: 16, rotate: 6 }}
        animate={{ opacity: 1, y: 0, rotate: 4 }}
        transition={{ duration: 0.75, ease: easePremium, delay: 0.45 }}
      >
        <GlassPanel className="border-cyan-100/90 bg-gradient-to-b from-white/95 to-cyan-50/20 p-3 shadow-[0_20px_48px_-24px_rgba(14,165,233,0.18)] backdrop-blur-md ring-1 ring-white/75">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Waveform</p>
          <div className="mt-2 flex h-16 items-end justify-center gap-[3px] px-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 origin-bottom rounded-full bg-gradient-to-t from-blue-600 via-cyan-500 to-violet-400"
                style={{ height: 40 }}
                animate={{ scaleY: [0.25, 0.92, 0.4, 0.78, 0.35, 1, 0.28] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.05, ease: easePremium }}
              />
            ))}
          </div>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute bottom-6 left-6 w-[78%] rotate-[-2deg]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: easePremium, delay: 0.65 }}
      >
        <div className="rounded-xl border border-sky-100/85 bg-white/88 px-3 py-2.5 shadow-[0_12px_36px_-20px_rgba(37,99,235,0.14)] backdrop-blur-md ring-1 ring-white/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Latency</span>
            <span className="font-mono font-bold text-emerald-700">142 ms</span>
          </div>
          <MiniSparklineDecor gradId="hero-spark-latency" className="mt-1 h-7 w-full opacity-90" />
        </div>
      </motion.div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <p className="bg-gradient-to-r from-blue-700 via-cyan-600 to-violet-600 bg-clip-text text-[15px] font-semibold uppercase tracking-[0.35em] text-transparent [background-size:120%_100%]">
      {children}
    </p>
  );
}

const btnPrimaryLight =
  "rounded-full border-0 bg-gradient-to-r from-[#2563eb] via-[#0891b2] to-[#14b8a6] px-8 font-semibold text-white shadow-[0_4px_16px_-4px_rgba(37,99,235,0.38),0_2px_6px_-2px_rgba(14,165,233,0.22)] transition-[transform,box-shadow,filter] duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_rgba(37,99,235,0.32),0_8px_24px_-10px_rgba(124,58,237,0.14)] active:translate-y-0";

const btnSecondaryLight =
  "h-12 rounded-full border border-sky-200/90 bg-white px-8 text-[15px] font-semibold text-slate-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200/85 hover:bg-gradient-to-br hover:from-sky-50/95 hover:to-violet-50/60 hover:text-slate-900 hover:shadow-[0_10px_28px_-14px_rgba(37,99,235,0.14)] active:translate-y-0";

function HoverLift({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <motion.span
      className="inline-block"
      initial={false}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
    >
      {children}
    </motion.span>
  );
}

function CallWaveBars(): JSX.Element {
  return (
    <div
      aria-hidden
      className="flex h-[7.25rem] items-end justify-center gap-1 rounded-2xl border border-sky-100/85 bg-white/92 px-5 py-4 shadow-[inset_0_2px_14px_rgba(37,99,235,0.07)] sm:gap-[5px]"
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1.5 origin-bottom rounded-full bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-400 opacity-95"
          style={{ height: 48 }}
          animate={{ scaleY: [0.2, 0.95, 0.38, 0.82, 0.45, 1, 0.22] }}
          transition={{
            repeat: Infinity,
            duration: 1.35,
            delay: i * 0.06,
            ease: easePremium,
          }}
        />
      ))}
    </div>
  );
}

function HeroBackground(): JSX.Element {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_52%,#edf4fc_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_72%_at_50%_-14%,rgba(96,165,250,0.38),transparent_56%),radial-gradient(ellipse_52%_48%_at_100%_36%,rgba(167,139,250,0.28),transparent_58%),radial-gradient(ellipse_48%_42%_at_0%_70%,rgba(45,212,191,0.22),transparent_56%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-mesh-drift opacity-70"
        style={{
          background:
            "radial-gradient(circle at 22% 28%, rgba(37,99,235,0.09) 0%, transparent 44%), radial-gradient(circle at 78% 32%, rgba(124,58,237,0.08) 0%, transparent 42%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[6] bg-[radial-gradient(rgb(148_163_184/0.1)_1px,transparent_1px)] [background-size:26px_26px] opacity-45 motion-reduce:opacity-20"
        style={{ maskImage: "linear-gradient(180deg, black 0%, black 50%, transparent 85%)" }}
      />
      <div className="pointer-events-none absolute inset-0 -z-[5]">
        <HeroParticlesSmall />
      </div>
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 -z-[5] h-[42%] w-full opacity-[0.35] animate-pulse-soft"
        preserveAspectRatio="none"
        viewBox="0 0 1200 280"
      >
        <defs>
          <linearGradient id="waveGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.42" />
            <stop offset="40%" stopColor="#22d3ee" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#a78bfa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <path
          d="M0,180 C120,120 200,220 320,150 C440,90 500,200 620,130 C760,50 820,190 960,110 C1040,75 1120,155 1200,100 L1200,280 L0,280 Z"
          fill="url(#waveGradLight)"
        />
        <path
          d="M0,200 Q300,100 600,180 T1200,140"
          fill="none"
          stroke="url(#waveGradLight)"
          strokeWidth="1.2"
          opacity="0.45"
        />
      </svg>
      <div className="pointer-events-none absolute -left-28 top-1/3 -z-[4] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.35)_0%,rgba(165,243,252,0.2)_55%,transparent_70%)] blur-[92px] animate-glow-shift" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 -z-[4] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.32)_0%,rgba(45,212,191,0.15)_55%,transparent_70%)] blur-[88px] animate-glow-shift [animation-delay:2s]" />
    </>
  );
}

export function LandingPageContent(): JSX.Element {
  const introPoints = [
    "Enterprise grade platform with isolated workspaces and clear controls for teams.",
    "AI voice agents authored with policies, knowledge, and tools deployed to production numbers.",
    "Campaign automation engine for compliant outbound execution and follow through.",
    "CRM and customer management unified with call context, transcripts, and timelines.",
    "Realtime AI call execution low latency speech, monitoring, and escalation paths.",
  ];

  const modules = [
    { title: "AI Agent Builder", icon: Sparkles, tint: "from-sky-300/65 to-transparent", iconAccent: "text-blue-600 group-hover:text-cyan-600" },
    { title: "Campaign Engine", icon: Zap, tint: "from-violet-200/80 to-transparent", iconAccent: "text-violet-600 group-hover:text-indigo-600" },
    { title: "Contact Management", icon: Users, tint: "from-teal-200/60 to-transparent", iconAccent: "text-teal-600 group-hover:text-cyan-600" },
    { title: "Live Call System", icon: Radio, tint: "from-cyan-100/75 to-transparent", iconAccent: "text-cyan-600 group-hover:text-sky-600" },
    { title: "Analytics Dashboard", icon: LayoutDashboard, tint: "from-emerald-100/70 to-transparent", iconAccent: "text-teal-600 group-hover:text-emerald-700" },
    { title: "Job & Scheduling System", icon: CalendarClock, tint: "from-blue-100/75 to-transparent", iconAccent: "text-blue-600 group-hover:text-sky-600" },
    { title: "Telephony Integration (Twilio)", icon: PhoneForwarded, tint: "from-indigo-100/75 to-transparent", iconAccent: "text-indigo-600 group-hover:text-violet-600" },
    { title: "Billing & Subscription System", icon: CreditCard, tint: "from-purple-100/75 to-transparent", iconAccent: "text-violet-600 group-hover:text-fuchsia-600" },
  ];

  const flowSteps = [
    { step: "01", label: "Create AI Agent", icon: Brain },
    { step: "02", label: "Upload Contacts", icon: Users },
    { step: "03", label: "Configure Campaigns", icon: Workflow },
    { step: "04", label: "Trigger Voice Calls", icon: PhoneOutgoing },
    { step: "05", label: "AI Handles Conversations", icon: Mic2 },
    { step: "06", label: "Store Results & Analytics", icon: LineChart },
  ];

  const businessWorkflow = [
    { label: "Reach the right contacts", icon: Users },
    { label: "Launch intelligent campaigns", icon: Zap },
    { label: "AI led voice conversations", icon: PhoneCall },
    { label: "Delight customers 24/7", icon: MessageSquare },
    { label: "See results & iterate", icon: TrendingUp },
  ];

  const experienceCards = [
    {
      key: "live",
      span: "wide" as const,
      title: "Live AI calls people recognize as professional",
      description:
        "Natural pacing, interruption handling, and brand safe responses so every dial feels like an extension of your team, not a robot reading a script.",
      bullets: ["Realtime voice that keeps callers engaged", "Smooth handoff to humans when stakes are high", "Recordings & transcripts your managers can trust"],
      icon: PhoneCall,
      panelClass: "from-cyan-50/95 via-white to-blue-50/80",
      iconWrap: "from-blue-100 to-cyan-100 ring-blue-200/70",
      iconClass: "text-blue-700",
    },
    {
      key: "agents",
      span: "normal" as const,
      title: "Voice agents with your knowledge",
      description: "Equip agents with FAQs, promotions, policies, and CRM context so answers stay accurate and on message.",
      icon: Bot,
      panelClass: "from-violet-50/70 to-white",
      iconWrap: "from-violet-100 to-purple-50 ring-violet-200/70",
      iconClass: "text-violet-700",
    },
    {
      key: "campaigns",
      span: "normal" as const,
      title: "Campaigns that run while you sleep",
      description: "Schedule outreach, nurture leads, and re-engage customers with compliant sequencing you control.",
      icon: Zap,
      panelClass: "from-amber-50/50 to-white",
      iconWrap: "from-amber-100 to-orange-50 ring-amber-200/60",
      iconClass: "text-amber-700",
    },
    {
      key: "experience",
      span: "normal" as const,
      title: "Every interaction remembered",
      description: "A single thread of voice, outcomes, and follow up no more lost context between channels or reps.",
      icon: MessageSquare,
      panelClass: "from-teal-50/70 to-white",
      iconWrap: "from-teal-100 to-cyan-50 ring-teal-200/65",
      iconClass: "text-teal-700",
    },
    {
      key: "growth",
      span: "normal" as const,
      title: "Growth without multiplying headcount",
      description: "More conversations answered, qualified, and progressed consistent quality at the scale your pipeline demands.",
      icon: TrendingUp,
      panelClass: "from-emerald-50/60 to-white",
      iconWrap: "from-emerald-100 to-teal-50 ring-emerald-200/60",
      iconClass: "text-emerald-700",
    },
    {
      key: "intelligence",
      span: "normal" as const,
      title: "Insights your leaders can act on",
      description: "See what scripts convert, where drop offs happen, and how AI is impacting revenue not just call volume.",
      icon: LineChart,
      panelClass: "from-sky-50/80 to-white",
      iconWrap: "from-sky-100 to-indigo-50 ring-sky-200/70",
      iconClass: "text-sky-800",
    },
  ];

  const useCaseBlocks = [
    { title: "Sales automation", body: "Prospect outreach, qualification, and CRM handoff at scale." },
    { title: "Customer support automation", body: "Tier 1 resolution with human escalation and full context." },
    { title: "Appointment booking", body: "Calendar aware scheduling with confirmations and reminders." },
    { title: "Lead qualification", body: "Consistent scripts, scoring, and routing to the right team." },
    { title: "Follow ups automation", body: "Sequences that renew, remind, and re-engage without manual load." },
  ];

  type PricingTier = {
    key: string;
    name: string;
    price: string;
    period: string;
    popular?: boolean;
    features: readonly { label: string; included: boolean }[];
    cta: string;
    href?: Route;
    baselineOnly?: boolean;
  };

  const pricingTiers: readonly PricingTier[] = [
    {
      key: "free",
      name: "Free",
      price: "$0",
      period: "/mo",
      features: [
        { label: "100 minutes", included: true },
        { label: "1 agent", included: true },
        { label: "No campaigns", included: false },
      ],
      cta: "Current Baseline",
      baselineOnly: true,
    },
    {
      key: "starter",
      name: "Starter",
      price: "$49",
      period: "/mo",
      popular: true,
      features: [
        { label: "500 minutes", included: true },
        { label: "3 agents", included: true },
        { label: "5 campaigns", included: true },
      ],
      cta: "Upgrade to Starter",
      href: "/sign-up",
    },
    {
      key: "pro",
      name: "Pro",
      price: "$149",
      period: "/mo",
      features: [
        { label: "2000 minutes", included: true },
        { label: "10 agents", included: true },
        { label: "20 campaigns", included: true },
      ],
      cta: "Upgrade to Pro",
      href: "/sign-up",
    },
  ];

  const heroStagger: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.11, delayChildren: 0.05 },
    },
  };

  const heroChild: Variants = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: easePremium } },
  };

  return (
    <main className="overflow-x-hidden">
      <section className="relative isolate flex min-h-[100dvh] w-full flex-col justify-center px-4 pb-28 pt-28 sm:px-6 lg:px-10 lg:pb-36 lg:pt-32">
        <HeroBackground />

        <div className="relative z-10 mx-auto w-full max-w-[1200px]">
          <motion.div
            className="w-full"
            initial="hidden"
            animate="visible"
            variants={heroStagger}
          >
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
              <div className="min-w-0 max-w-[820px] flex-1">
            <motion.div variants={heroChild}>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/65 bg-gradient-to-r from-white via-white to-sky-50/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-[0_2px_14px_-4px_rgba(37,99,235,0.14)] backdrop-blur-sm transition-[box-shadow,transform,border-color] hover:border-violet-200/50 hover:shadow-[0_4px_22px_-6px_rgba(37,99,235,0.18)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/45 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 ring-2 ring-cyan-200/85" />
                </span>
                Enterprise voice infrastructure
              </div>
            </motion.div>

            <motion.h1 variants={heroChild} className="mt-10 text-balance font-bold tracking-[-0.045em] text-textPrimary text-[clamp(2.25rem,5.5vw,4.25rem)] leading-[1.02]">
              AI Voice Infrastructure for{" "}
              <span className="bg-gradient-to-r from-[#1d4ed8] via-cyan-600 to-violet-600 bg-clip-text text-transparent">
                Business Communication
              </span>{" "}
              Automation
            </motion.h1>

            <motion.p variants={heroChild} className="mt-8 max-w-[640px] text-pretty text-base leading-relaxed text-textSecondary sm:text-lg sm:leading-relaxed">
              Grace AI is a multictenant <strong className="font-semibold text-textPrimary">AI voice operating system</strong>{" "}
              for business automation agents, telephony, campaigns, CRM, and analytics in one coherent platform built for
              production traffic.
            </motion.p>

            <motion.div variants={heroChild}>
              <HeroLiveRibbon />
            </motion.div>

            <motion.div variants={heroChild} className="mt-12 flex flex-wrap items-center gap-4">
              <HoverLift>
                <Button asChild size="lg" className={cn("h-12 gap-2 text-[15px]", btnPrimaryLight)}>
                  <Link href={"/sign-up" as Route}>
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </HoverLift>
              <HoverLift>
                <Button asChild variant="outline" size="lg" className={btnSecondaryLight}>
                  <Link href={"/#what-is-grace" as Route}>Explore Platform</Link>
                </Button>
              </HoverLift>
            </motion.div>

            <motion.div variants={heroChild} className="mt-16 sm:mt-20">
              <motion.a
                href="#what-is-grace"
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-textSecondary"
                whileHover={{ x: 2, color: "rgb(37 99 235)" }}
                transition={{ duration: 0.2 }}
              >
                System intro
                <ArrowDown className="h-4 w-4 text-blue-600" />
              </motion.a>
            </motion.div>
              </div>

              <motion.div variants={heroChild} className="relative hidden w-full max-w-[380px] shrink-0 lg:block">
                <HeroAmbientStack />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="what-is-grace"
        className="scroll-mt-24 w-full border-t border-sky-100/80 bg-gradient-to-b from-slate-50/95 via-[#f5f9ff] to-slate-50/90 px-4 py-24 sm:px-6 lg:px-10 lg:py-32"
      >
        <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20 lg:items-start">
          <motion.div {...fadeBlur}>
            <SectionLabel>What is Grace AI</SectionLabel>
            <h2 className="mt-6 text-balance text-[clamp(2rem,4vw,3.25rem)] font-bold tracking-tight leading-[1.08] text-textPrimary">
              A structured voice platform for operators who ship.
            </h2>
          </motion.div>
          <motion.div
            className="space-y-6 pt-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px", amount: 0.2 }}
            variants={staggerContainer}
          >
            <motion.p variants={staggerItemTight} className="text-lg font-medium leading-snug text-textPrimary/95">
              Grace AI coordinates models, carriers, and customer data so your organization can run voice automation as
              core infrastructure not a side integration.
            </motion.p>
            <motion.ul variants={staggerList} className="relative space-y-2 pl-8">
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-9 w-[5px] rounded-full bg-gradient-to-b from-blue-300 via-cyan-300 to-violet-400 shadow-[0_0_10px_-1px_rgba(34,211,238,0.22)]"
              />
              {introPoints.map((line) => (
                <motion.li
                  key={line}
                  variants={staggerItemTight}
                  className="relative text-base leading-relaxed text-textSecondary"
                >
                  <span className="absolute -left-[9px] top-2 h-3 w-3 -translate-x-[21px] rounded-full bg-gradient-to-br from-[#2563eb] via-cyan-400 to-violet-500 ring-2 ring-white shadow-[0_1px_10px_-2px_rgba(37,99,235,0.4)]" />
                  {line}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      <section id="platform-modules" className="scroll-mt-24 w-full border-t border-sky-100/80 bg-white px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <motion.div {...fadeBlur} className="max-w-2xl">
            <SectionLabel>Core platform modules</SectionLabel>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-textPrimary sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              Composable systems. Single control plane.
            </h2>
            <p className="mt-5 max-w-xl text-lg text-textSecondary">
              Each module is designed for clarity under load with limits, observability, and predictable behavior.
            </p>
          </motion.div>

          <motion.div
            className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-48px", amount: 0.15 }}
            variants={staggerContainer}
          >
            {modules.map((m) => (
              <motion.article
                key={m.title}
                variants={staggerItemTight}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                className={cn(
                  "group relative cursor-default overflow-hidden rounded-xl border border-sky-100/90 bg-white p-6",
                  "shadow-[0_2px_8px_-4px_rgba(37,99,235,0.06)]",
                  "transition-[border-color,box-shadow,transform] hover:border-cyan-200/75 hover:shadow-[0_12px_36px_-18px_rgba(37,99,235,0.14)]"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                    m.tint
                  )}
                />
                <div className="relative">
                  <m.icon
                    className={cn("h-6 w-6 transition-transform duration-300 group-hover:scale-110", m.iconAccent)}
                    strokeWidth={1.25}
                  />
                  <h3 className="mt-4 text-[18px] font-semibold leading-snug tracking-tight text-textPrimary">{m.title}</h3>
                  <span className="mt-5 inline-flex h-px w-10 bg-gradient-to-r from-[#2563eb] via-cyan-400 to-violet-500 opacity-85 transition-all duration-300 group-hover:w-16" />
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-24 w-full border-t border-sky-100/80 bg-gradient-to-b from-slate-50/95 via-[#fafcff] to-white px-4 py-24 sm:px-6 lg:px-10 lg:py-32"
      >
        <div className="mx-auto max-w-[1200px]">
          <motion.div {...fadeBlur} className="mx-auto max-w-2xl text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-textPrimary sm:text-4xl">Operational flow</h2>
            <p className="mt-5 text-lg text-textSecondary">
              A linear path from configuration to measurable outcomes built for audit and iteration.
            </p>
          </motion.div>

          <div className="relative mt-20 hidden lg:block">
            <div className="absolute left-[6%] right-[6%] top-[46px] z-0 h-px bg-gradient-to-r from-transparent via-cyan-200/90 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.25)]" aria-hidden />
            <motion.div
              className="relative z-10 flex items-start justify-between gap-1"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={staggerContainer}
            >
              {flowSteps.map((node) => (
                <motion.div key={node.step} variants={staggerItemTight} className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center">
                  <motion.div
                    whileHover={{ y: -6, scale: 1.04 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className="group w-full max-w-[150px]"
                  >
                    <GlassPanel className="w-full px-3 py-4 transition-[border-color,box-shadow] duration-300 group-hover:border-cyan-200/90 group-hover:shadow-[0_10px_28px_-14px_rgba(37,99,235,0.12)]">
                      <span className="text-[25px] font-bold tabular-nums bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        {node.step}
                      </span>
                      <node.icon className="mx-auto mt-2 h-6 w-6 text-slate-700 transition-colors group-hover:text-blue-700" strokeWidth={1.2} />
                      <p className="mt-2.5 text-[17px] font-semibold leading-snug text-textPrimary">{node.label}</p>
                    </GlassPanel>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="mt-12 space-y-3 lg:hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {flowSteps.map((node) => (
              <motion.div key={node.step} variants={staggerItemTight} className="flex items-center gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 text-[10px] font-bold text-blue-700 ring-1 ring-blue-100/90 shadow-[0_2px_8px_-4px_rgba(37,99,235,0.12)]">
                  {node.step}
                </span>
                <motion.div className="min-w-0 flex-1" whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                  <GlassPanel className="flex items-center gap-3 p-4">
                    <node.icon className="h-5 w-5 text-textPrimary" strokeWidth={1.2} />
                    <span className="text-sm font-medium text-textPrimary">{node.label}</span>
                  </GlassPanel>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section
        id="experience"
        className="scroll-mt-24 w-full border-t border-sky-100/80 bg-gradient-to-b from-white via-[#f8fbff] to-slate-50/90 px-4 py-24 sm:px-6 lg:px-10 lg:py-32"
      >
        <div className="mx-auto max-w-[1200px]">
          <motion.div {...fadeBlur} className="mx-auto max-w-2xl text-center">
            <SectionLabel>The Grace experience</SectionLabel>
            <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight text-textPrimary sm:text-4xl">
              Powerful AI voice your customers and your leaders actually feel
            </h2>
            <p className="mt-5 text-pretty text-lg text-textSecondary">
              See how teams turn everyday phone moments into workflows: smarter outreach, conversational service, measurable
              growth without drowning in jargon or engineering diagrams.
            </p>
          </motion.div>

          <motion.div
            className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-48px", amount: 0.12 }}
            variants={staggerContainer}
          >
            {experienceCards.map((card) => (
              <motion.article
                key={card.key}
                variants={staggerItemTight}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 360, damping: 26 }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-sky-100/90 bg-gradient-to-br shadow-[0_2px_12px_-6px_rgba(37,99,235,0.08)] transition-[box-shadow,border-color] hover:border-cyan-200/80 hover:shadow-[0_16px_40px_-22px_rgba(37,99,235,0.14)]",
                  card.panelClass,
                  card.span === "wide" ? "lg:col-span-2" : "",
                  card.span === "wide" ? "p-7 sm:p-8" : "p-6 sm:p-7"
                )}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_85%_-10%,rgba(96,165,250,0.12),transparent_55%)] opacity-70"
                />

                {card.span === "wide" ? (
                  <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ring-1 shadow-sm",
                          card.iconWrap
                        )}
                      >
                        <card.icon className={cn("h-6 w-6", card.iconClass)} strokeWidth={1.2} aria-hidden />
                      </div>
                      <h3 className="text-xl font-bold tracking-tight text-textPrimary sm:text-2xl">{card.title}</h3>
                      <p className="mt-4 text-sm leading-relaxed text-textSecondary sm:text-base">{card.description}</p>
                      {card.bullets ? (
                        <ul className="mt-6 space-y-3 text-medium text-textSecondary">
                          {card.bullets.map((b) => (
                            <li key={b} className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 ring-2 ring-white shadow-sm" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="shrink-0 lg:w-[min(100%,300px)]">
                      <CallWaveBars />
                      <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Interactive voice in motion
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex h-full flex-col">
                    <div
                      className={cn(
                        "mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ring-1 shadow-sm transition-transform duration-300 group-hover:scale-105",
                        card.iconWrap
                      )}
                    >
                      <card.icon className={cn("h-5 w-5", card.iconClass)} strokeWidth={1.2} aria-hidden />
                    </div>
                    <h3 className="text-base font-bold leading-snug text-textPrimary sm:text-lg">{card.title}</h3>
                    <p className="mt-3 flex-1 text-lg leading-relaxed text-textSecondary">{card.description}</p>
                    <span className="mt-6 inline-flex h-px w-12 bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 opacity-85 transition-all duration-300 group-hover:w-20" />
                  </div>
                )}
              </motion.article>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px", amount: 0.2 }}
            transition={{ duration: 0.65, ease: easePremium }}
            className="relative mt-16 overflow-hidden rounded-2xl border border-sky-100/90 bg-white/95 px-6 py-10 shadow-[0_8px_32px_-20px_rgba(37,99,235,0.12)] sm:px-0 sm:py-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(239,246,255,0.9)_0%,transparent_40%,transparent_58%,rgba(245,243,255,0.85)_100%)]"
            />
            <motion.p
              className="relative text-center text-[25px] font-semibold uppercase tracking-[0.32em] text-transparent bg-gradient-to-r from-blue-600 via-cyan-600 to-violet-600 bg-clip-text"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 }}
            >
              Real business workflows
            </motion.p>
            <p className="relative mx-auto mt-3 max-w-2xl text-center text-medium leading-relaxed text-textSecondary">
              From first outbound dial to renewed revenue Grace keeps every milestone visible to your operators and execs.
            </p>

            <motion.div
              role="list"
              className="relative mt-4 flex flex-wrap items-center justify-center gap-y-10 gap-x-2 sm:gap-x-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-24px" }}
              variants={staggerContainer}
            >
              {businessWorkflow.map((step, idx) => (
                <motion.div key={step.label} variants={staggerItemTight} role="listitem" className="flex flex-col items-center sm:flex-row sm:items-center">
                  <div className="flex w-[min(100%,11.5rem)] flex-col items-center text-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-100/90 bg-gradient-to-br from-white to-blue-50/70 shadow-[0_4px_16px_-8px_rgba(37,99,235,0.15)] transition-transform duration-300 hover:scale-[1.04]">
                      <step.icon className="h-6 w-6 text-blue-700" strokeWidth={1.2} aria-hidden />
                    </div>
                    <p className="mt-3 text-[20px] font-semibold leading-snug text-slate-800 sm:mt-2 sm:text-sm">{step.label}</p>
                    <span className="mt-1 font-mono text-[20px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  {idx < businessWorkflow.length - 1 ? (
                    <span className="mt-5 flex shrink-0 items-center justify-center text-violet-300 sm:mx-3 sm:mt-0 lg:mx-5" aria-hidden>
                      <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" strokeWidth={1.35} />
                    </span>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="use-cases" className="scroll-mt-15 w-full border-t border-sky-100/80 bg-gradient-to-b from-slate-50/85 to-[#f5f9ff]/90 px-4 py-24 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1200px]">
          <motion.div {...fadeBlur} className="max-w-2xl">
            <SectionLabel>Use cases</SectionLabel>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-textPrimary sm:text-4xl">
              Operational patterns
            </h2>
            <p className="mt-5 text-lg text-textSecondary">
              Minimal blocks swap copy as you tighten vertical narratives.
            </p>
          </motion.div>

          <motion.div
            className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-44px", amount: 0.18 }}
            variants={staggerContainer}
          >
            {useCaseBlocks.map((uc) => (
              <motion.div
                key={uc.title}
                variants={staggerItemTight}
                whileHover={{
                  y: -4,
                  borderColor: "rgba(147,197,253,0.95)",
                  boxShadow: "0 16px 40px -20px rgba(37,99,235,0.1), 0 6px 20px -12px rgba(124,58,237,0.06)",
                }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="group cursor-default rounded-xl border border-sky-100/90 bg-white px-6 py-7 shadow-[0_2px_10px_-6px_rgba(37,99,235,0.06)]"
              >
                <GitBranch className="h-5 w-5 text-violet-600 transition-transform duration-300 group-hover:-translate-y-px group-hover:text-blue-700" strokeWidth={1.2} />
                <h3 className="mt-4 text-base font-bold text-textPrimary">{uc.title}</h3>
                <p className="mt-2 text-medium leading-relaxed text-textSecondary">{uc.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="value" className="scroll-mt-24 w-full border-t border-sky-100/80 bg-white px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
        <div className="mx-auto max-w-[900px] text-center">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-64px", amount: 0.35 }}
            transition={{ duration: 0.75, ease: easePremium }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              Vision
            </p>
            <h2 className="mx-auto mt-8 text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-bold tracking-tight leading-[1.1] text-textPrimary">
              Transform Business Communication into an{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-[#1d4ed8] via-cyan-600 to-violet-600 bg-clip-text text-transparent">
                  Intelligent AI System
                </span>
                <span
                  aria-hidden
                  className="absolute -bottom-2 left-1/2 h-[3px] w-[min(100%,300px)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-violet-300 opacity-90"
                />
              </span>
            </h2>
            <motion.p
              className="mx-auto mt-10 max-w-2xl text-pretty text-lg text-textSecondary"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12, duration: 0.55 }}
            >
              Unify carrier voice, frontier models, and business data behind one operator grade surface purpose built for
              teams that treat communication as critical infrastructure.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-24 w-full border-t border-sky-100/80 bg-[linear-gradient(180deg,#ffffff_0%,#f3f9ff_38%,#eef4fc_100%)] px-4 py-24 sm:px-6 lg:px-10 lg:py-28"
      >
        <div className="relative mx-auto max-w-[1200px]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 left-1/2 h-72 w-[min(100%,52rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.12)_0%,rgba(167,139,250,0.08)_42%,transparent_68%)] blur-3xl"
          />

          <motion.div {...fadeBlur} className="relative mx-auto max-w-[720px] text-center">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mx-auto mt-6 text-balance text-3xl font-bold tracking-tight text-textPrimary sm:text-4xl lg:text-[2.375rem]">
              Upgrade Your Grace AI Plan
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-textSecondary sm:text-lg">
              Scale AI voice operations with higher minutes, concurrent agents, and campaign capacity all on the same enterprise
              platform your team already trusts.
            </p>
          </motion.div>

          <motion.ul
            className="relative mt-16 grid list-none gap-8 pt-2 sm:gap-10 lg:mt-20 lg:grid-cols-3 lg:gap-8 lg:pt-6 lg:[align-items:start]"
            role="list"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-56px", amount: 0.15 }}
            variants={staggerContainer}
          >
            {pricingTiers.map((tier) => (
              <motion.li key={tier.key} variants={staggerItem} className="relative min-h-0 lg:mx-0">
                {tier.popular ? (
                  <div className="absolute -top-4 left-1/2 z-20 -translate-x-1/2">
                    <span className="inline-flex rounded-full bg-gradient-to-r from-[#2563eb] via-cyan-500 to-violet-600 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-white shadow-[0_8px_24px_-6px_rgba(37,99,235,0.45)] ring-4 ring-white/90">
                      Most Popular
                    </span>
                  </div>
                ) : null}
                <motion.div
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className={cn(
                    "relative flex h-full flex-col overflow-hidden rounded-2xl p-px motion-reduce:transform-none motion-reduce:transition-none",
                    tier.popular
                      ? "z-10 bg-gradient-to-br from-blue-500/90 via-cyan-400/85 to-violet-600/95 shadow-[0_26px_64px_-24px_rgba(37,99,235,0.38),0_12px_40px_-20px_rgba(124,58,237,0.18)] transition-[transform,box-shadow] duration-500 lg:scale-[1.035] lg:shadow-[0_32px_72px_-28px_rgba(37,99,235,0.42),0_16px_48px_-24px_rgba(14,165,233,0.16)] motion-reduce:lg:scale-100"
                      : "bg-gradient-to-b from-sky-100/95 to-white/95 shadow-[0_14px_40px_-24px_rgba(30,64,175,0.08)] transition-[transform,box-shadow] duration-500"
                  )}
                  whileHover={{
                    y: tier.popular ? -10 : -6,
                    boxShadow: tier.popular
                      ? "0 36px 80px -28px rgba(37,99,235,0.45), 0 20px 52px -24px rgba(124,58,237,0.22)"
                      : "0 22px 48px -20px rgba(37,99,235,0.14), 0 10px 28px -16px rgba(124,58,237,0.1)",
                    transition: { type: "spring", stiffness: 380, damping: 26 },
                  }}
                >
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-[15px] border border-white/80 bg-white/92 px-8 pb-8 pt-9 backdrop-blur-md sm:px-9 sm:pb-10 sm:pt-10",
                      tier.popular && "bg-[linear-gradient(165deg,#ffffff_0%,#fafcff_52%,rgba(236,253,255,0.65)_100%)]"
                    )}
                  >
                    {tier.popular ? (
                      <>
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -right-12 top-24 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_62%)] blur-2xl"
                        />
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -left-8 bottom-16 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.16)_0%,transparent_65%)] blur-2xl"
                        />
                      </>
                    ) : null}

                    <div className="relative">
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">{tier.name}</h3>
                      <div className="mt-5 flex items-baseline gap-1">
                        <span className="font-mono text-[2.25rem] font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2.5rem]">
                          {tier.price}
                        </span>
                        <span className="text-base font-medium text-slate-500">{tier.period}</span>
                      </div>
                    </div>

                    <ul className="relative mt-8 flex flex-1 flex-col gap-3.5 text-left text-[15px]">
                      {tier.features.map((row) => (
                        <li key={row.label} className="flex items-start gap-3">
                          {row.included ? (
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-cyan-50 ring-1 ring-emerald-200/80">
                              <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} aria-hidden />
                            </span>
                          ) : (
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200/90">
                              <span className="h-1 w-2.5 rounded-full bg-slate-400" aria-hidden />
                            </span>
                          )}
                          <span className={cn("leading-snug", row.included ? "text-slate-800" : "text-slate-500")}>
                            {row.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="relative mt-10">
                      {tier.baselineOnly ? (
                        <Button
                          type="button"
                          disabled
                          aria-label="Current plan tier: Free baseline limits"
                          className="w-full rounded-full border border-sky-200/90 bg-slate-50/90 py-6 text-[15px] font-semibold text-slate-700 shadow-inner transition-colors duration-300 disabled:opacity-[0.88]"
                        >
                          {tier.cta}
                        </Button>
                      ) : (
                        <HoverLift>
                          <Button
                            asChild
                            size="lg"
                            className={cn("h-auto min-h-12 w-full rounded-full px-8 py-[1.125rem] text-[15px] font-semibold", btnPrimaryLight)}
                          >
                            <Link href={(tier.href ?? "/sign-up") as Route}>{tier.cta}</Link>
                          </Button>
                        </HoverLift>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      <section id="cta" className="scroll-mt-24 border-t border-sky-100/80 bg-bgBase px-4 pb-20 pt-8 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-48px", amount: 0.25 }}
          transition={{ duration: 0.65, ease: easePremium }}
          whileHover={{
            boxShadow: "0 28px 64px -28px rgba(37,99,235,0.14), 0 16px 40px -24px rgba(124,58,237,0.08)",
          }}
          className="relative mx-auto max-w-[960px] overflow-hidden rounded-2xl border border-sky-200/70 bg-white px-8 py-16 text-center shadow-[0_4px_24px_-16px_rgba(37,99,235,0.1)] sm:px-12 sm:py-20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,#ffffff_38%,rgba(250,245,255,0.92)_68%,rgba(236,253,245,0.88)_100%)]"
          />
          <div aria-hidden className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.35)_0%,transparent_65%)] blur-[68px]" />
          <div aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.28)_0%,transparent_65%)] blur-[60px]" />
          <div className="relative">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Start Building Your AI Voice System Today
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-xl">
              Provision agents, connect numbers, and run your first workloads with the clarity expected of enterprise
              software.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <HoverLift>
                <Button asChild size="lg" className={cn("h-12 px-10 text-[15px]", btnPrimaryLight)}>
                  <Link href={"/sign-up" as Route}>Sign Up</Link>
                </Button>
              </HoverLift>
              <HoverLift>
                <Button asChild size="lg" variant="outline" className={btnSecondaryLight}>
                  <Link href={"/contact" as Route}>Contact Sales</Link>
                </Button>
              </HoverLift>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
