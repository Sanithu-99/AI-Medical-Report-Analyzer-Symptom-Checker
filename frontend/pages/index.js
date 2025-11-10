import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import {
  SparklesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  UsersIcon,
  CheckCircleIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#platform", label: "Platform" },
  { href: "#contact", label: "Contact" },
];

const heroHighlights = [
  "Decode terminology into human language",
  "Surface anomalies clinicians flag most",
  "Compare historical trends automatically",
  "Share ready-to-send summaries securely",
];

const previewModes = [
  {
    id: "clinician",
    label: "Clinician view",
    badge: "Sample clinical summary",
    summary:
      "A structured narrative prioritises risk markers, supporting quick decisions during ward rounds or telehealth consults.",
    highlights: [
      "Highlights markers trending upward with suggested follow-up checks.",
      "Links each finding back to the source paragraph for rapid verification.",
      "Adds contextual notes physicians can edit before sharing with patients.",
    ],
  },
  {
    id: "patient",
    label: "Patient view",
    badge: "Sample patient-friendly explanation",
    summary:
      "Plain-language guidance reframes clinical language into clear next steps patients can act on with confidence.",
    highlights: [
      "Explains what each lab range means in everyday language.",
      "Emphasises action items and lifestyle tips approved by your team.",
      "Generates optional translations for multilingual handouts.",
    ],
  },
  {
    id: "operations",
    label: "Operations view",
    badge: "Sample workflow insight",
    summary:
      "Operational dashboards surface throughput, turnaround time, and pending reviews so administrators can unblock teams.",
    highlights: [
      "Shows review queues by modality and priority to reduce bottlenecks.",
      "Tracks turnaround time against your internal SLAs in real time.",
      "Exports anonymised trends for quality and compliance reporting.",
    ],
  },
];

const features = [
  {
    title: "Explain complex findings instantly",
    description:
      "Transform dense radiology, pathology, and lab reports into plain-language summaries tailored to patients and providers.",
    icon: SparklesIcon,
  },
  {
    title: "Quantify risk and trends visually",
    description:
      "Interactive visualisations highlight deltas, out-of-range markers, and longitudinal trends so decisions happen faster.",
    icon: ChartBarIcon,
  },
  {
    title: "Keep every team member aligned",
    description:
      "One-click sharing packages analytics, context, and recommended next steps for physicians, case managers, and patients.",
    icon: UsersIcon,
  },
  {
    title: "Stay compliant without slowing down",
    description:
      "SOC2-ready infrastructure, granular access controls, and audit logs protect sensitive data while keeping workflows nimble.",
    icon: ShieldCheckIcon,
  },
];

const steps = [
  {
    title: "Upload any medical document",
    description:
      "Drop in PDFs, scans, or HL7 feeds. Our OCR and NLP pipeline recognises medical terminology with 99% accuracy.",
  },
  {
    title: "Review the AI narrative",
    description:
      "Instant summaries flag abnormal values, correlate symptoms, and translate jargon into patient-ready language.",
  },
  {
    title: "Share and act with confidence",
    description:
      "Send a secure link, export to your EHR, or brief the care team right away—every insight stays synced automatically.",
  },
];

const personas = [
  {
    id: "physicians",
    label: "Physicians",
    headline: "Stay ahead of critical shifts without sifting through every line.",
    description:
      "Flag urgent deltas, prep for consults, and hand off with clarity. The workspace keeps evidence and reasoning side-by-side so you can move from review to action in minutes.",
    outcomes: [
      "See baseline changes across labs, imaging, and notes in one view.",
      "Prioritise follow-ups with severity-aware alerts you control.",
      "Annotate findings and sync back to your existing EHR workflow.",
      "Surface AI suggestions while retaining full clinical oversight.",
    ],
    workflowTitle: "Suggested quick wins for physicians",
    workflow: [
      "Import overnight results before rounds to pre-triage cases.",
      "Use live comparison to reference previous discharge summaries.",
      "Share an edited patient summary ahead of bedside consults.",
    ],
  },
  {
    id: "care-coordinators",
    label: "Care coordinators",
    headline: "Keep every stakeholder aligned from admission through discharge.",
    description:
      "Consolidate physician notes, discharge instructions, and tasks into a single briefing that updates as care plans evolve.",
    outcomes: [
      "Auto-generate checklists for follow-up labs and appointments.",
      "Track task status so nothing falls through between shifts.",
      "Generate plain-language care plans for family members.",
      "Capture patient questions and feed them back to clinicians.",
    ],
    workflowTitle: "Suggested quick wins for coordinators",
    workflow: [
      "Review AI summaries to assemble post-discharge instructions.",
      "Attach required documents and send secure updates to family contacts.",
      "Log completion of follow-ups so teams see real-time status.",
    ],
  },
  {
    id: "analysts",
    label: "Quality & data analysts",
    headline: "Understand population-level trends without manual aggregation.",
    description:
      "Slice aggregate metrics, spot variance across units, and export anonymised insights for quality improvement initiatives.",
    outcomes: [
      "Filter cases by modality, condition, or provider in seconds.",
      "Detect emerging trends and outliers across your patient panels.",
      "Export clean data packages for further modelling in your BI stack.",
      "Document audit trails for compliance reviews effortlessly.",
    ],
    workflowTitle: "Suggested quick wins for analysts",
    workflow: [
      "Schedule batches of reports for nightly processing and tagging.",
      "Use built-in filters to review cases with unresolved follow-ups.",
      "Export anonymised aggregates for quarterly QI reporting.",
    ],
  },
];

const faqItems = [
  {
    question: "What medical data sources can we connect?",
    answer:
      "You can upload PDFs, DICOM exports, HL7 feeds, or pull structured data from FHIR-compatible systems. Our team helps you configure secure connectors during onboarding.",
  },
  {
    question: "How does the AI handle clinical nuance?",
    answer:
      "We blend OCR, entity recognition, and reasoning models tuned on clinician-reviewed datasets. Every generated statement cites its source so you can validate and edit before sharing.",
  },
  {
    question: "Does this replace our existing EHR?",
    answer:
      "No—Med Analyzr AI enhances your current stack. Summaries, annotations, and tasks sync back to your EHR or BI tools so teams keep their familiar workflows.",
  },
  {
    question: "How is patient data protected?",
    answer:
      "Data stays encrypted in transit and at rest. Role-based access controls, audit logs, and configurable retention policies make it straightforward to align with HIPAA and SOC2 requirements.",
  },
];

export default function Home() {
  const [activeMode, setActiveMode] = useState(previewModes[0].id);
  const [activePersona, setActivePersona] = useState(personas[0].id);
  const [openFaq, setOpenFaq] = useState(faqItems[0]?.question ?? null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePreview =
    previewModes.find((mode) => mode.id === activeMode) ?? previewModes[0];
  const activePersonaData =
    personas.find((persona) => persona.id === activePersona) ?? personas[0];

  return (
    <>
      <Head>
        <title>Med Analyzr AI</title>
        <meta
          name="description"
          content="Med Analyzr AI helps clinicians interpret medical reports in seconds with plain-language summaries, anomaly detection, and secure collaboration."
        />
      </Head>
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(63,110,161,0.18),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(52,179,160,0.14),_transparent_55%)]" />
          <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-teal/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl space-y-24 px-4 py-16 sm:px-8">
          <header className="sticky top-6 z-40 rounded-3xl border border-white/80 bg-white/95 px-5 py-4 shadow-soft backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="#home"
                className="flex items-center gap-3 text-left"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg">
                  <Image
                    src="/med-analyzr-ai-logo.png"
                    alt="Med Analyzr AI logo"
                    width={40}
                    height={40}
                    priority
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-base font-semibold text-ocean">Med Analyzr AI</p>
                  <p className="text-xs text-ocean/60">Clinical intelligence suite</p>
                </div>
              </Link>
              <nav className="hidden items-center gap-4 md:flex">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-4 py-2 text-sm font-medium text-ocean/70 transition hover:text-teal"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="hidden items-center gap-3 md:flex">
                <Link
                  href="/login"
                  className="rounded-full border border-sand/70 px-4 py-2 text-sm font-semibold text-ocean transition hover:border-teal/60 hover:text-teal"
                >
                  Login
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                >
                  Get started
                </Link>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-sand/70 p-2 text-ocean/60 transition hover:border-teal/60 hover:text-teal md:hidden"
                onClick={() => setMobileMenuOpen((value) => !value)}
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </button>
            </div>
            {mobileMenuOpen && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/95 p-4 md:hidden">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-ocean/80 transition hover:bg-sand/60"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 rounded-xl border border-sand/70 px-3 py-2 text-center text-sm font-semibold text-ocean transition hover:border-teal/60 hover:text-teal"
                  >
                    Login
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 rounded-xl bg-teal px-3 py-2 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                  >
                    Get started
                  </Link>
                </div>
              </div>
            )}
          </header>

          <section id="home" className="grid gap-12 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-8">
              <span className="inline-flex w-max items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-teal">
                Clinician-first AI workspace
              </span>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight text-ocean sm:text-5xl lg:text-6xl">
                  Translate medical data into decisive action in minutes
                </h1>
                <p className="max-w-xl text-base text-ocean/70">
                  Upload diagnostics, extract clinical narratives, and keep patients, providers, and operations aligned in one secure workspace. Every insight cites its source so you stay in control.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                >
                  Get started
                </Link>
                <Link
                  href="#platform"
                  className="inline-flex items-center justify-center rounded-full border border-sand/70 px-6 py-3 text-sm font-semibold text-ocean transition hover:border-teal/60 hover:text-teal"
                >
                  Explore the workspace
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {heroHighlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-ocean/80 shadow-soft"
                  >
                    <CheckCircleIcon className="h-5 w-5 text-teal" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass gradient-border flex flex-col justify-between gap-6 rounded-[2.5rem] p-8">
              <div className="space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full border border-sand/70 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-ocean/60">
                  Real-time context
                </p>
                <h2 className="text-2xl font-semibold text-ocean">From raw reports to ready briefings</h2>
                <p className="text-sm text-ocean/70">
                  Seamless OCR, entity recognition, and narrative generation compress the review cycle while keeping every recommendation traceable.
                </p>
              </div>
              <div className="space-y-3 text-sm text-ocean/80">
                {previewModes[0].highlights.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-teal" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-white/80 bg-white/90 p-4 text-xs text-ocean/60">
                Hosted on encrypted, audit-ready infrastructure with granular access controls.
              </div>
            </div>
          </section>

          <section
            id="about"
            className="space-y-8 rounded-[2.5rem] border border-white/80 bg-white/95 p-10 shadow-soft backdrop-blur-xl"
          >
            <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">About us</p>
                <h2 className="text-3xl font-semibold text-ocean">Clinical-grade insight without the lag</h2>
                <p className="text-sm text-ocean/70">
                  Med Analyzr AI brings together document intelligence, clinician oversight, and operational
                  visibility. We partner with care teams to streamline interpretation workflows while maintaining full
                  provenance, so every AI recommendation can be trusted, audited, and refined by humans in the loop.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.3em] text-teal">Deployment</p>
                    <p className="mt-2 text-lg font-semibold text-ocean">Weeks, not months</p>
                    <p className="mt-2 text-sm text-ocean/70">
                      Lightweight APIs and sandbox environments accelerate your pilots without disrupting production
                      systems.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.3em] text-teal">Trust</p>
                    <p className="mt-2 text-lg font-semibold text-ocean">Explainable by design</p>
                    <p className="mt-2 text-sm text-ocean/70">
                      Source citations, human-in-the-loop approvals, and granular access controls keep clinical teams in
                      command.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                  <p className="text-sm font-semibold text-ocean">Our mission</p>
                  <p className="mt-2 text-sm text-ocean/70">
                    Equip multidisciplinary teams with context-rich insights so they can focus on critical decisions,
                    not document triage.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                  <p className="text-sm font-semibold text-ocean">Our promise</p>
                  <p className="mt-2 text-sm text-ocean/70">
                    Every workflow is co-designed with clinicians, ensuring the experience respects existing protocols
                    while elevating collaboration.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="platform" className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">Workspace previews</p>
                <h2 className="text-3xl font-semibold text-ocean">Choose the lens you need</h2>
                <p className="text-sm text-ocean/70">
                  Switch between clinician, patient, and operations-ready summaries without duplicating effort.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 rounded-full border border-white/80 bg-white/90 p-1 shadow-soft">
                {previewModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setActiveMode(mode.id)}
                    className={clsx(
                      "rounded-full px-4 py-2 text-xs font-medium transition",
                      activeMode === mode.id
                        ? "bg-teal text-white shadow-lg"
                        : "text-ocean/70 hover:text-teal"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
              <div className="glass gradient-border space-y-6 p-8">
                <span className="inline-flex w-max items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-teal">
                  {activePreview.badge}
                </span>
                <p className="text-lg font-semibold text-ocean">{activePreview.summary}</p>
                <ul className="space-y-3 text-sm text-ocean/80">
                  {activePreview.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 inline-block h-2.5 w-2.5 flex-none rounded-full bg-teal" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass gradient-border space-y-4 p-8">
                <h3 className="text-lg font-semibold text-ocean">Why teams switch</h3>
                <p className="text-sm text-ocean/70">
                  The platform adapts to each role while maintaining a single source of truth for clinical decisions and patient follow-ups.
                </p>
                <div className="space-y-3 text-sm text-ocean/80">
                  <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-soft">
                    <p className="font-semibold text-ocean">Snapshot for stakeholders</p>
                    <p className="mt-1 text-ocean/70">
                      Generate concise summaries for leadership while retaining the depth clinicians need.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-soft">
                    <p className="font-semibold text-ocean">Evidence always cited</p>
                    <p className="mt-1 text-ocean/70">
                      Every recommendation links to the originating paragraph or data point to maintain trust.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="space-y-8">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">Platform pillars</p>
              <h2 className="text-3xl font-semibold text-ocean">Designed for frontline and analytical teams</h2>
              <p className="text-sm text-ocean/70">
                Intelligent automation paired with guardrails so you can accelerate workflows without compromising on clinical judgment or compliance.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="glass gradient-border flex h-full flex-col gap-4 p-6"
                  >
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                      <Icon className="h-5 w-5 text-teal" />
                      {feature.title}
                    </div>
                    <p className="text-sm text-ocean/80">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="workflow" className="space-y-6">
            <div className="space-y-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">Workflow in focus</p>
              <h2 className="text-3xl font-semibold text-ocean">How teams move from upload to action</h2>
              <p className="mx-auto max-w-2xl text-sm text-ocean/70">
                Three steps bring specialised diagnostics, AI summaries, and coordinated follow-ups together without changing your core systems.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="glass gradient-border flex h-full flex-col gap-3 p-6 text-left"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-teal">
                    Step {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-ocean">{step.title}</h3>
                  <p className="text-sm text-ocean/70">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="personas" className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">Tailored rollouts</p>
                <h2 className="text-3xl font-semibold text-ocean">Built for teams across the continuum</h2>
                <p className="text-sm text-ocean/70">
                  Toggle personas to explore the quick wins surfaced for each group.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 rounded-full border border-white/80 bg-white/90 p-1 shadow-soft">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setActivePersona(persona.id)}
                    className={clsx(
                      "rounded-full px-4 py-2 text-xs font-medium transition",
                      activePersona === persona.id
                        ? "bg-teal text-white shadow-lg"
                        : "text-ocean/70 hover:text-teal"
                    )}
                  >
                    {persona.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass gradient-border grid gap-10 p-8 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-5">
                <h3 className="text-2xl font-semibold text-ocean">{activePersonaData.headline}</h3>
                <p className="text-sm text-ocean/80">{activePersonaData.description}</p>
                <ul className="grid gap-3 text-sm text-ocean/80">
                  {activePersonaData.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-3">
                      <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-teal" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4 rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                <p className="text-sm font-semibold text-ocean">{activePersonaData.workflowTitle}</p>
                <ul className="space-y-3 text-sm text-ocean/80">
                  {activePersonaData.workflow.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-teal" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="faq" className="space-y-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">FAQ</p>
              <h2 className="text-3xl font-semibold text-ocean">Answers to common questions</h2>
              <p className="text-sm text-ocean/70">
                Need deeper details? Book a live session after signing up—we can walk through your environment.
              </p>
            </div>
            <div className="space-y-3">
              {faqItems.map((item) => {
                const isOpen = openFaq === item.question;
                return (
                  <div key={item.question} className="glass gradient-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : item.question)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-ocean">{item.question}</span>
                      <span className="text-xl text-teal">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-white/80 px-6 py-4 text-sm text-ocean/80">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section
            id="contact"
            className="space-y-8 rounded-[2.5rem] border border-white/80 bg-white/95 p-10 shadow-soft backdrop-blur-xl"
          >
            <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">Contact</p>
                <h2 className="text-3xl font-semibold text-ocean">Partner with our clinical enablement team</h2>
                <p className="text-sm text-ocean/70">
                  Share a few details about your organisation and we will tailor a walkthrough with the specialists who
                  support clinical, operational, and informatics deployments.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.3em] text-teal">Email</p>
                    <p className="mt-2 text-lg font-semibold text-ocean">hello@aimedicalanalyzer.com</p>
                    <p className="mt-2 text-sm text-ocean/60">We reply within one business day.</p>
                  </div>
                  <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.3em] text-teal">Consultations</p>
                    <p className="mt-2 text-lg font-semibold text-ocean">Mon–Fri · 8am–6pm ET</p>
                    <p className="mt-2 text-sm text-ocean/60">Secure virtual demo environments available on request.</p>
                  </div>
                </div>
              </div>
              <div className="glass gradient-border space-y-4 p-6">
                <p className="text-sm font-semibold text-ocean">Ready for a guided tour?</p>
                <p className="text-sm text-ocean/70">
                  Provide your care setting and priorities—we will curate a session focused on clinical safety,
                  workflow integration, and governance.
                </p>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/50">Next steps</p>
                  <ul className="space-y-2 text-sm text-ocean/70">
                    <li>• Schedule a 30-minute discovery call with our clinician advisors.</li>
                    <li>• Explore a sandbox environment mapped to your specialties.</li>
                    <li>• Receive a tailored rollout checklist including compliance guardrails.</li>
                  </ul>
                </div>
                <Link
                  href="mailto:hello@aimedicalanalyzer.com?subject=AI%20Medical%20Analyzer%20Demo"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                >
                  Request a consultation
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
