import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ChartBarIcon, GlobeAltIcon, ShieldCheckIcon, UsersIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageShell from "@/components/PageShell";

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
};

export default function InstitutionAnalyticsPage() {
  const router = useRouter();
  const { user, status, plan, role } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canView = plan === "institution" || role === "admin";

  useEffect(() => {
    if (status !== "ready") return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canView) {
      router.replace("/pricing");
      return;
    }

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/reports/analytics/overview");
        setAnalytics(response.data);
      } catch (err) {
        const detail =
          err?.response?.data?.detail || "Unable to load institutional analytics right now.";
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [status, user, canView, router]);

  const riskTerms = analytics?.risk_terms ?? [];
  const timeline = analytics?.timeline ?? [];
  const recentReports = analytics?.recent_reports ?? [];
  const ageBuckets = analytics?.quasi_identifiers?.age_buckets ?? [];
  const regions = analytics?.quasi_identifiers?.regions ?? [];
  const genders = analytics?.quasi_identifiers?.gender ?? [];

  const planLabel = useMemo(() => {
    if (role === "admin") return "Administrator";
    if (plan === "institution") return "Institution";
    return plan;
  }, [plan, role]);

  return (
    <>
      <Head>
        <title>Institutional Analytics | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <Navbar />
        <main className="section-stack">
            <section className="section-card p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ocean/60">{planLabel} workspace</p>
                  <h1 className="mt-2 text-3xl font-semibold text-ocean">Institutional analytics</h1>
                  <p className="mt-2 max-w-2xl text-sm text-ocean/70">
                    Monitor uploads across patients, highlight emerging risk factors, and review anonymised quasi-identifiers without exposing PHI.
                  </p>
                </div>
                <div className="section-card section-card--compact text-sm text-ocean/70">
                  <p className="text-xs uppercase tracking-[0.3em] text-ocean/50">Access tier</p>
                  <p className="text-lg font-semibold text-ocean">
                    {canView ? "Institution" : "Upgrade required"}
                  </p>
                  <p className="mt-1 text-xs text-ocean/60">Only institution tenants and admins can view this page.</p>
                </div>
              </div>
            </section>

            {error && (
              <div className="section-card section-card--compact border-rose-200 bg-rose-50/80 text-sm text-rose-700">
                {error}
              </div>
            )}

            <section className="grid gap-4 md:grid-cols-3">
              <article className="section-card section-card--compact">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ocean/60">
                  <UsersIcon className="h-4 w-4 text-teal" />
                  Reports analysed
                </div>
                <p className="mt-3 text-3xl font-semibold text-ocean">
                  {loading ? "…" : analytics?.report_count ?? 0}
                </p>
                <p className="mt-2 text-xs text-ocean/60">Unique uploads across your institution.</p>
              </article>
              <article className="section-card section-card--compact">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ocean/60">
                  <ChartBarIcon className="h-4 w-4 text-teal" />
                  Trend days
                </div>
                <p className="mt-3 text-3xl font-semibold text-ocean">{timeline.length}</p>
                <p className="mt-2 text-xs text-ocean/60">
                  Distinct days with activity. Fresh uploads keep analytics calibrated.
                </p>
              </article>
              <article className="section-card section-card--compact">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ocean/60">
                  <ShieldCheckIcon className="h-4 w-4 text-teal" />
                  Plan tier
                </div>
                <p className="mt-3 text-3xl font-semibold text-ocean capitalize">{planLabel}</p>
                <p className="mt-2 text-xs text-ocean/60">Includes anonymisation, exports, and multi-user teams.</p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
              <article className="section-card p-6">
                <header className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ocean/60">Risk drivers</p>
                    <h2 className="text-2xl font-semibold text-ocean">Most referenced lab themes</h2>
                  </div>
                </header>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-ocean/80">
                  {riskTerms.length === 0 && (
                    <p className="text-ocean/60">Upload reports to see aggregated risk distribution.</p>
                  )}
                  {riskTerms.map((item) => (
                    <span
                      key={item.term}
                      className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2 text-amber-700"
                    >
                      {item.term} · {item.count}
                    </span>
                  ))}
                </div>
              </article>
              <article className="section-card p-6">
                <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/60">
                  <GlobeAltIcon className="h-4 w-4 text-teal" />
                  Quasi-identifier mix
                </header>
                <div className="mt-4 space-y-3 text-sm text-ocean/70">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ocean/50">Age buckets</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ageBuckets.length ? (
                        ageBuckets.map((bucket) => (
                          <span
                            key={bucket.label}
                            className="rounded-full border border-white/80 bg-white px-3 py-1 text-xs text-ocean"
                          >
                            {bucket.label}: {bucket.count}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-ocean/50">No age data yet.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ocean/50">Regions</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {regions.length ? (
                        regions.map((region) => (
                          <span
                            key={region.label}
                            className="rounded-full border border-white/80 bg-white px-3 py-1 text-xs text-ocean"
                          >
                            {region.label}: {region.count}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-ocean/50">Upload reports with ZIP metadata.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ocean/50">Gender signals</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {genders.length ? (
                        genders.map((item) => (
                          <span
                            key={item.label}
                            className="rounded-full border border-white/80 bg-white px-3 py-1 text-xs text-ocean"
                          >
                            {item.label}: {item.count}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-ocean/50">No gender-level signals detected.</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
              <article className="section-card p-6">
                <header className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ocean/60">Daily activity</p>
                    <h2 className="text-2xl font-semibold text-ocean">Upload timeline</h2>
                  </div>
                </header>
                <div className="mt-4 space-y-3 text-sm text-ocean/70">
                  {timeline.length === 0 && (
                    <p className="text-ocean/60">No timeline data yet. Upload reports to populate this view.</p>
                  )}
                  {timeline.map((point) => (
                    <div
                      key={point.date}
                      className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/95 px-4 py-2"
                    >
                      <span>{formatDate(point.date)}</span>
                      <span className="font-semibold text-ocean">{point.count}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="section-card p-6">
                <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/60">
                  <UsersIcon className="h-4 w-4 text-teal" />
                  Recent uploads
                </header>
                <div className="mt-4 space-y-3 text-sm text-ocean/70">
                  {recentReports.length === 0 && (
                    <p className="text-ocean/60">Upload reports to see the latest anonymised activity.</p>
                  )}
                  {recentReports.map((report) => (
                    <div key={report.id} className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-soft">
                      <p className="text-sm font-semibold text-ocean">{report.report_name}</p>
                      <p className="text-xs text-ocean/50">{formatDate(report.created_at)}</p>
                      <p className="mt-2 text-sm text-ocean/70">
                        {(report.summary || "No summary provided.").slice(0, 160)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </main>
        </PageShell>
    </>
  );
}
