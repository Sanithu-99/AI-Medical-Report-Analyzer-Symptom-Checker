import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import clsx from "clsx";
import {
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import UploadBox from "@/components/UploadBox";
import ChartSection from "@/components/ChartSection";
import api from "@/lib/api";

const detailTabs = [
  { id: "summary", label: "AI Summary" },
  { id: "insights", label: "Insights" },
  { id: "source", label: "Source text" },
];

const symptomPrompts = [
  "Shortness of breath with chest pressure",
  "Fatigue after a recent surgery",
  "Recurring migraines with blurred vision",
];

const relativeTime = (timestamp) => {
  if (!timestamp) return null;
  const msDifference = new Date(timestamp).getTime() - Date.now();
  const seconds = Math.round(msDifference / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const thresholds = [
    { limit: 60, divisor: 1, unit: "second" },
    { limit: 3600, divisor: 60, unit: "minute" },
    { limit: 86400, divisor: 3600, unit: "hour" },
    { limit: 604800, divisor: 86400, unit: "day" },
    { limit: 2629800, divisor: 604800, unit: "week" },
    { limit: Infinity, divisor: 2629800, unit: "month" },
  ];

  for (const { limit, divisor, unit } of thresholds) {
    if (Math.abs(seconds) < limit) {
      return rtf.format(Math.round(seconds / divisor), unit);
    }
  }

  return null;
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

const wordCount = (text) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

export default function Dashboard() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailTab, setDetailTab] = useState(detailTabs[0].id);
  const [symptoms, setSymptoms] = useState("");
  const [symptomInsights, setSymptomInsights] = useState([]);
  const [symptomStatus, setSymptomStatus] = useState("");
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [notification, setNotification] = useState("");
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const response = await api.get("/api/reports");
      const items = response.data || [];
      const sorted = [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setReports(sorted);
      setSelectedReport((current) => {
        if (!current) return sorted[0] ?? null;
        const match = sorted.find((report) => report.id === current.id);
        return match ?? sorted[0] ?? null;
      });
    } catch (error) {
      console.warn("Failed to fetch reports", error);
      setNotification("We couldn't load your reports. Please try again.");
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }

    loadReports();
  }, [router, loadReports]);

  const handleUpload = async (file) => {
    setUploading(true);
    setNotification("");
    try {
      const formData = new FormData();
      formData.append("report_file", file);
      const response = await api.post("/api/reports/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newReport = response.data;

      setReports((previous) => {
        const merged = [newReport, ...previous.filter((item) => item.id !== newReport.id)];
        return merged.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setSelectedReport(newReport);
      setDetailTab("summary");
      setNotification("Report analysed successfully.");
    } catch (error) {
      const detail = error.response?.data?.detail || "Upload failed. Please try again.";
      setNotification(detail);
    } finally {
      setUploading(false);
    }
  };

  const handleSymptomCheck = async (event) => {
    event.preventDefault();
    if (!symptoms.trim()) return;

    setSymptomStatus("");
    setSymptomLoading(true);
    try {
      const response = await api.post("/api/symptoms", { symptoms });
      const possible = response.data?.possible_conditions || [];
      setSymptomInsights(possible);
      setSymptomStatus(
        possible.length > 0
          ? "Symptom analysis ready."
          : "No matches found. Try adding more detail or context."
      );
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to analyse symptoms right now.";
      setSymptomStatus(detail);
    } finally {
      setSymptomLoading(false);
    }
  };

  const handleReportSelect = (report) => {
    setSelectedReport(report);
    setDetailTab("summary");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const chartData = useMemo(() => {
    if (!selectedReport?.insights) return [];
    return selectedReport.insights.map((insight, index) => {
      const [labelPart, valuePart] = insight.split(":");
      const valueMatch = valuePart?.match(/([0-9.]+)/);
      const value = valueMatch ? Number(valueMatch[1]) : 20 + index * 10;
      return {
        label: labelPart?.trim() || `Insight ${index + 1}`,
        value,
      };
    });
  }, [selectedReport]);

  const metrics = useMemo(() => {
    const totalReports = reports.length;
    const totalInsights = reports.reduce(
      (accumulator, report) => accumulator + (report.insights?.length || 0),
      0
    );
    const latestReport = reports[0];
    const activeInsights = selectedReport?.insights?.length || 0;
    const summaryWords = selectedReport ? wordCount(selectedReport.ai_summary) : 0;
    const relative = latestReport ? relativeTime(latestReport.created_at) : null;

    return [
      {
        id: "reports",
        label: "Reports processed",
        value: totalReports.toLocaleString("en-US"),
        helper: latestReport
          ? `Latest update ${relative || "recently"}`
          : "Upload your first report to begin.",
        icon: DocumentTextIcon,
      },
      {
        id: "insights",
        label: "Insights captured",
        value: totalInsights.toLocaleString("en-US"),
        helper: selectedReport
          ? `${activeInsights} in the active report`
          : "Insights appear after an analysis runs.",
        icon: SparklesIcon,
      },
      {
        id: "summary",
        label: "Active summary length",
        value: summaryWords > 0 ? `${summaryWords.toLocaleString("en-US")} words` : "—",
        helper: selectedReport
          ? `Generated ${formatDateTime(selectedReport.created_at)}`
          : "Select a report to see details.",
        icon: ChartBarIcon,
      },
      {
        id: "last-analysis",
        label: "Last analysis",
        value: latestReport ? relative || formatDateTime(latestReport.created_at) : "—",
        helper: latestReport
          ? formatDateTime(latestReport.created_at)
          : "Once a report finishes analysing it appears here.",
        icon: ClockIcon,
      },
    ];
  }, [reports, selectedReport]);

  const activeTabContent = useMemo(() => {
    if (!selectedReport) {
      return (
        <p className="text-sm text-ocean/60">
          Upload a medical report to view AI summaries, key findings, and raw OCR output in one place.
        </p>
      );
    }

    if (detailTab === "summary") {
      return (
        <div className="space-y-4 text-sm leading-relaxed text-ocean/70">
          {selectedReport.ai_summary ? (
            selectedReport.ai_summary.split(/\n{2,}/).map((paragraph, index) => (
              <p
                key={index}
                className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-ocean"
              >
                {paragraph.trim()}
              </p>
            ))
          ) : (
            <p className="text-ocean/60">The AI narrative will appear once analysis is complete.</p>
          )}
        </div>
      );
    }

    if (detailTab === "insights") {
      return (
        <ul className="space-y-3 text-sm text-ocean/70">
          {selectedReport.insights?.length ? (
            selectedReport.insights.map((insight) => (
              <li
                key={insight}
                className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3"
              >
                <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-teal" />
                <span>{insight}</span>
              </li>
            ))
          ) : (
            <li className="text-ocean/60">
              Insights will appear as soon as the report is analysed.
            </li>
          )}
        </ul>
      );
    }

    return (
      <pre className="max-h-[320px] overflow-y-auto rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm leading-relaxed text-ocean/70">
        {selectedReport.extracted_text || "Raw OCR output will be available here after processing."}
      </pre>
    );
  }, [detailTab, selectedReport]);

  return (
    <>
      <Head>
        <title>Dashboard | Med Analyzr AI</title>
      </Head>
      <div className="relative min-h-screen px-4 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(63,110,161,0.18),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(52,179,160,0.14),_transparent_55%)]" />
        </div>
        <div className="relative mx-auto max-w-6xl space-y-10">
          <Navbar />
          <main className="space-y-10">
            {notification && (
              <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/80 bg-white px-4 py-3 text-sm text-ocean/70 shadow-soft">
                <span>{notification}</span>
                <button
                  type="button"
                  onClick={() => setNotification("")}
                  className="rounded-full border border-transparent p-1 text-ocean/60 transition hover:border-teal/40 hover:text-teal"
                  aria-label="Dismiss notification"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            <section className="glass gradient-border p-8">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
                <div className="flex-1 space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal/70">
                      Command centre
                    </p>
                    <h1 className="text-3xl font-semibold text-ocean md:text-4xl">
                      Welcome back to your AI medical workspace
                    </h1>
                    <p className="max-w-xl text-sm text-ocean/80">
                      Upload new diagnostics, review AI narratives, and keep symptoms aligned—all from one secure hub.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {metrics.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div
                          key={metric.id}
                          className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft"
                        >
                          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ocean/60">
                            <Icon className="h-4 w-4 text-teal" />
                            {metric.label}
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-ocean">{metric.value}</p>
                          <p className="mt-2 text-xs text-ocean/60">{metric.helper}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="w-full max-w-sm space-y-4">
                  <UploadBox onUpload={handleUpload} uploading={uploading} variant="compact" />
                  <div className="rounded-3xl border border-white/80 bg-white/90 p-4 text-sm text-ocean/80">
                    <p className="font-semibold text-ocean">Need a quick start?</p>
                    <p className="mt-1 text-ocean/60">
                      Drag in lab results, imaging summaries, or discharge notes. AI parses medical jargon and surfaces
                      what matters.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.75fr,1fr]">
              <div className="space-y-6">
                <section className="glass gradient-border p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">
                        Active report
                      </p>
                      <h2 className="text-2xl font-semibold text-ocean">
                        {selectedReport?.report_name || "Awaiting upload"}
                      </h2>
                      <p className="text-xs text-ocean/60">
                        {selectedReport ? formatDateTime(selectedReport.created_at) : "Upload to view details"}
                      </p>
                    </div>
                    <div className="flex gap-2 rounded-full border border-white/80 bg-white/90 p-1">
                      {detailTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDetailTab(tab.id)}
                          className={clsx(
                            "rounded-full px-4 py-2 text-xs font-medium transition",
                            detailTab === tab.id
                              ? "bg-teal text-ocean shadow-lg"
                              : "text-ocean/80 hover:text-teal"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6">{activeTabContent}</div>
                </section>

                <ChartSection data={chartData} />
              </div>

              <aside className="space-y-6">
                <section className="glass gradient-border p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-ocean">Symptom checker</h3>
                      <p className="text-xs text-ocean/60">
                        Describe what the patient is feeling. AI suggests likely conditions to explore.
                      </p>
                    </div>
                    {symptomInsights.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSymptomInsights([]);
                          setSymptomStatus("");
                          setSymptoms("");
                        }}
                        className="text-xs font-medium text-ocean/60 underline-offset-2 hover:text-teal hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {symptomPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setSymptoms(prompt)}
                        className="rounded-full border border-white/80 px-3 py-1 text-xs text-ocean/80 transition hover:border-teal hover:text-teal"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <form className="mt-4 space-y-4" onSubmit={handleSymptomCheck}>
                    <textarea
                      value={symptoms}
                      onChange={(event) => setSymptoms(event.target.value)}
                      placeholder="e.g., persistent fatigue, dizziness, shortness of breath"
                      className="w-full min-h-[120px] rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={symptomLoading}
                    >
                      {symptomLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                      {symptomLoading ? "Analysing…" : "Analyse symptoms"}
                    </button>
                  </form>
                  {symptomStatus && <p className="mt-3 text-xs text-ocean/60">{symptomStatus}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {symptomInsights.length > 0 ? (
                      symptomInsights.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs text-ocean/70"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-ocean/50">
                        Insights appear here once the AI finishes reviewing the symptoms.
                      </p>
                    )}
                  </div>
                </section>

                <section className="glass gradient-border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ocean">Recent reports</h3>
                      <p className="text-xs text-ocean/60">
                        Select a report to review its narrative and insights.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="flex items-center gap-2 rounded-full border border-white/80 px-3 py-1 text-xs font-medium text-ocean/80 transition hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={refreshing}
                    >
                      <ArrowPathIcon className={clsx("h-4 w-4", refreshing && "animate-spin")} />
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-3">
                    {reports.length > 0 ? (
                      reports.map((report) => {
                        const isActive = selectedReport?.id === report.id;
                        return (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => handleReportSelect(report)}
                            className={clsx(
                              "w-full rounded-2xl border px-4 py-3 text-left transition",
                              isActive
                                ? "border-teal/60 bg-teal/10 shadow-lg"
                                : "border-white/80 bg-white/90 hover:border-teal/40 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-ocean">{report.report_name}</p>
                              {isActive && (
                                <span className="rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-ocean/60">{formatDateTime(report.created_at)}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-ocean/50">
                              <span className="rounded-full border border-white/80 px-2 py-0.5">
                                {report.insights?.length ?? 0} insights
                              </span>
                              <span className="rounded-full border border-white/80 px-2 py-0.5">
                                {wordCount(report.ai_summary)} words
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-ocean/50">
                        Once you upload documents, their AI summaries and insights will appear here for quick access.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
