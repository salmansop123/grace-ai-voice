"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, MapPin, MessageCircle, MessageSquare, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ContactPageContent(): JSX.Element {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSent(true);
  }

  const inputClass =
    "w-full rounded-xl border border-sky-100/90 bg-white px-4 py-3 text-sm text-textPrimary outline-none placeholder:text-textSecondary/65 shadow-[0_1px_2px_rgba(37,99,235,0.04)] transition-[box-shadow,border-color] focus:border-cyan-400/80 focus:ring-2 focus:ring-blue-100";

  const panelSurface =
    "flex h-full flex-col rounded-2xl border border-sky-100/90 bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(37,99,235,0.04),0_14px_44px_-28px_rgba(37,99,235,0.08)] lg:p-10";

  return (
    <main className="min-h-[calc(100dvh-5rem)]">
      <section className="relative isolate overflow-hidden border-b border-sky-100/85 bg-gradient-to-b from-white via-[#f6f9ff] to-bgBase px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_95%_68%_at_50%_-14%,rgba(96,165,250,0.42),transparent_56%),radial-gradient(ellipse_48%_44%_at_10%_50%,rgba(167,139,250,0.22),transparent_58%),radial-gradient(ellipse_48%_44%_at_90%_50%,rgba(45,212,191,0.18),transparent_58%)]"
        />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-24 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -right-32 top-24 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.22)_0%,transparent_70%)] blur-[100px]" />

        <div className="mx-auto flex max-w-[1200px] flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl"
          >
            <p className="bg-gradient-to-r from-blue-700 via-cyan-600 to-violet-600 bg-clip-text text-[11px] font-semibold uppercase tracking-[0.35em] text-transparent">
              Enterprise contact
            </p>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-[3.25rem] md:leading-[1.06]">
              Talk to our team
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
              Demos, procurement questions, security reviews, and technical deep dives minimal friction, maximum clarity.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] items-stretch gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-24">
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="flex h-full min-h-0"
        >
          <div className={`w-full ${panelSurface}`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-gradient-to-r from-blue-50/90 to-cyan-50/50 px-3 py-1 text-xs font-medium text-blue-800 shadow-[0_2px_10px_-6px_rgba(37,99,235,0.12)]">
              <MessageCircle className="h-3.5 w-3.5 text-blue-600" aria-hidden />
              Sales & solutions
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">Talk to our team</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Replace placeholders with your routing. This page is styled for a credible first touch with enterprise
              buyers.
            </p>
            <ul className="mt-8 space-y-5 text-sm">
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 ring-1 ring-blue-100/80">
                  <Mail className="h-5 w-5 text-blue-600" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Email</p>
                  <p className="text-slate-600">support@graceai.com</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 ring-1 ring-violet-100/80">
                  <MapPin className="h-5 w-5 text-violet-600" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">HQ</p>
                  <p className="text-slate-600">8 Waterside Drive, Langley, Slough, England, SL3 6EP</p>
                </div>
              </li>
            </ul>
          </div>
        </motion.aside>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`flex h-full min-h-0 ${panelSurface}`}
        >
          {sent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center sm:py-14">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 ring-1 ring-teal-100 shadow-[0_4px_16px_-8px_rgba(45,212,191,0.25)]">
                <Send className="h-7 w-7 text-teal-600" aria-hidden />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Message captured</h3>
              <p className="max-w-md text-sm leading-relaxed text-slate-600">
                Wire this form to your CRM or inbox. For now the UI confirms the submission path is ready.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 border-sky-200/90 bg-white shadow-sm transition-[border-color,box-shadow] hover:border-violet-200 hover:bg-gradient-to-br hover:from-sky-50/80 hover:to-violet-50/50 hover:shadow-md"
                onClick={() => setSent(false)}
              >
                Send another
              </Button>
            </div>
          ) : (
            <form className="w-full flex-1 space-y-6" onSubmit={handleSubmit}>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/65 bg-gradient-to-r from-violet-50/80 to-blue-50/60 px-3 py-1 text-xs font-medium text-violet-900 shadow-[0_2px_10px_-6px_rgba(124,58,237,0.12)]">
                  <MessageSquare className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                  Written inquiry
                </div>
                <h2 className="mt-6 text-xl font-bold text-slate-900">Send a message</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">
                  We respond within one business day.
                </p>
              </div>
              <div className="space-y-5">
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-900">Name</span>
                  <input required name="name" className={inputClass} placeholder="Your name" />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-900">Email</span>
                  <input required name="email" type="email" className={inputClass} placeholder="you@company.com" />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-900">Message</span>
                  <textarea
                    required
                    name="message"
                    rows={6}
                    className={`${inputClass} resize-y min-h-[140px]`}
                    placeholder="Tell us about your use case, volumes, and timelines…"
                  />
                </label>
              </div>
              <Button
                type="submit"
                size="lg"
                className="group w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-[#2563eb] via-[#0891b2] to-[#14b8a6] font-semibold text-white shadow-[0_4px_18px_-6px_rgba(37,99,235,0.35)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-10px_rgba(37,99,235,0.3)]"
              >
                Submit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <p className="text-[13px] leading-relaxed text-slate-500">
                By submitting, you agree to be contacted about Grace AI products. Unsubscribe anytime.
              </p>
            </form>
          )}
        </motion.div>
      </section>
    </main>
  );
}
