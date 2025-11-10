import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import clsx from "clsx";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageShell from "@/components/PageShell";

const PLAN_ORDER = ["individual", "clinician", "institution"];

export default function PricingPage() {
  const { user, plan, status, refresh } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await api.get("/api/auth/plans");
        setPlans(
          PLAN_ORDER.map((key) => response.data.find((planItem) => planItem.key === key)).filter(Boolean)
        );
      } catch (error) {
        console.warn("Failed to load plans", error);
      }
    };
    loadPlans();
  }, []);

  const handleSelect = async (planKey) => {
    if (!user) {
      setMessage("Sign in to activate a plan.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await api.post("/api/auth/plan/select", { plan: planKey });
      await refresh();
      setMessage(`Plan updated to ${planKey}.`);
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to update plan.";
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  const planCards = plans.map((planInfo) => {
    const isActive = plan === planInfo.key && user;
    return (
      <div
        key={planInfo.key}
        className={clsx(
          "section-card section-card--compact transition-transform",
          planInfo.key === "institution"
            ? "border-teal/50"
            : planInfo.key === "clinician"
            ? "border-sand/70"
            : "border-white/70",
          isActive ? "ring-2 ring-teal/40" : "hover:-translate-y-1"
        )}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-ocean/60">{planInfo.name}</p>
        <h2 className="mt-3 text-3xl font-semibold text-ocean">
          {planInfo.monthly_reports ? `${planInfo.monthly_reports}+ reports` : "Unlimited reports"}
        </h2>
        <p className="mt-2 text-sm text-ocean/60">
          {planInfo.symptom_checks
            ? `${planInfo.symptom_checks} symptom checks per month`
            : "Unlimited symptom intelligence"}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ocean/70">
          {Object.entries(planInfo.features).map(([feature, enabled]) => (
            <li key={feature} className="flex items-center gap-2">
              <span
                className={clsx(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                  enabled ? "bg-teal/10 text-teal" : "bg-sand/50 text-sand-800"
                )}
              >
                {enabled ? "✓" : "–"}
              </span>
              <span className="capitalize">{feature.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => handleSelect(planInfo.key)}
          disabled={loading || isActive}
          className={clsx(
            "mt-6 w-full rounded-full px-4 py-2 text-sm font-semibold transition",
            isActive
              ? "border border-teal/40 text-teal"
              : "bg-teal text-white shadow-lg hover:bg-teal/90 disabled:opacity-70"
          )}
        >
          {isActive ? "Current plan" : user ? "Select plan" : "Sign in to choose"}
        </button>
      </div>
    );
  });

  return (
    <>
      <Head>
        <title>Plans & Pricing | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <Navbar />
        <main className="section-stack">
          <section className="section-card">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ocean/60">Med Analyzr AI</p>
                  <h1 className="mt-2 text-4xl font-semibold text-ocean">Choose your compliance-ready workspace</h1>
                  <p className="mt-2 max-w-2xl text-sm text-ocean/70">
                    Plans scale from solo clinicians to enterprise institutions. Every tier includes encrypted storage,
                    automatic PHI anonymisation, VPN blocking, and audit logging.
                  </p>
                </div>
                {!user && status === "ready" && (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                  >
                    Sign in to continue
                  </Link>
                )}
              </div>
            </section>

          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{planCards}</section>

          {message && (
            <div className="section-card section-card--compact text-sm text-ocean/70">{message}</div>
          )}
        </main>
      </PageShell>
    </>
  );
}
