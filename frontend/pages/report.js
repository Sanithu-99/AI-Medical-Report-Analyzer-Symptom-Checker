import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import clsx from "clsx";
import Navbar from "@/components/Navbar";
import AiSummary from "@/components/AiSummary";
import api from "@/lib/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
  Filler,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  DocumentArrowDownIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

const wordCount = (text) => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const extractInsightDetails = (insights = []) =>
  insights.map((insight, index) => {
    const [labelPart, valuePart] = insight.split(":");
    const valueMatch = valuePart?.match(/-?\d+(?:\.\d+)?/);
    return {
      id: `${index}-${insight}`,
      label: (labelPart || insight || `Insight ${index + 1}`).trim(),
      value: valueMatch ? Number(valueMatch[0]) : null,
      raw: insight,
    };
  });

const deriveCarePlan = (selectedReport) => {
  if (!selectedReport) {
    return [
      "Share upcoming visit dates so both patient and clinician can review the analysis together.",
      "Encourage patients to log new symptoms in the portal before their next appointment.",
      "Attach relevant imaging or lab results when exporting to keep the PDF dossier comprehensive.",
    ];
  }

  const summary = selectedReport.ai_summary?.toLowerCase() || "";
  const combinedInsights = (selectedReport.insights || []).join(" ").toLowerCase();
  const suggestions = new Set();

  if (/blood pressure|hypertension/.test(combinedInsights)) {
    suggestions.add("Check blood pressure trend logs and add them to the exported report for cardiology review.");
  }

  if (/glucose|diabetes/.test(combinedInsights) || /glucose|insulin/.test(summary)) {
    suggestions.add("Schedule a fasting glucose follow-up and include recent readings when sharing the PDF.");
  }

  if (/imaging|scan|mri|ct/.test(summary)) {
    suggestions.add("Link imaging results in the export so radiology teams can cross-reference findings.");
  }

  if (/medication|dose|therapy/.test(summary)) {
    suggestions.add("Confirm current medication dosages with the patient and track adjustments in the exported plan.");
  }

  if (/follow[- ]?up|review/.test(summary)) {
    suggestions.add("Set a reminder for the requested follow-up and surface the timeline in the printable summary.");
  }

  if (suggestions.size < 3) {
    suggestions.add("Highlight lifestyle observations or symptom diaries alongside the AI summary for patient clarity.");
  }
  if (suggestions.size < 4) {
    suggestions.add("Capture action items in the PDF export so every stakeholder sees the next recommended steps.");
  }

  return Array.from(suggestions).slice(0, 4);
};

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [exportFeedback, setExportFeedback] = useState("");

  const loadReports = useCallback(async () => {
    setError("");
    setLoading(true);
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
    } catch (err) {
      console.warn("Failed to load reports", err);
      setError("We couldn't load your reports right now. Please refresh in a moment.");
    } finally {
      setLoading(false);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const aggregatedMetrics = useMemo(() => {
    if (!reports.length) return null;

    const totalInsights = reports.reduce(
      (accumulator, report) => accumulator + (report.insights?.length || 0),
      0
    );
    const totalSummaryWords = reports.reduce(
      (accumulator, report) => accumulator + wordCount(report.ai_summary),
      0
    );

    const uniqueFocusAreas = new Set();
    reports.forEach((report) => {
      (report.insights || []).forEach((insight) => {
        const label = insight.split(":")[0]?.trim().toLowerCase();
        if (label) uniqueFocusAreas.add(label);
      });
    });

    const richestReport = [...reports].sort(
      (a, b) => wordCount(b.ai_summary) - wordCount(a.ai_summary)
    )[0];

    return {
      totalReports: reports.length,
      totalInsights,
      averageInsights: reports.length ? totalInsights / reports.length : 0,
      averageSummaryWords: reports.length ? totalSummaryWords / reports.length : 0,
      latestReport: reports[0],
      focusAreaCount: uniqueFocusAreas.size,
      richestReportName: richestReport?.report_name || "—",
      richestReportWords: wordCount(richestReport?.ai_summary),
    };
  }, [reports]);

  const selectedInsightDetails = useMemo(
    () => extractInsightDetails(selectedReport?.insights),
    [selectedReport]
  );

  const numericInsightEntries = useMemo(
    () => selectedInsightDetails.filter((insight) => insight.value !== null),
    [selectedInsightDetails]
  );

  const insightChartData = useMemo(() => {
    if (!numericInsightEntries.length) return null;
    return {
      labels: numericInsightEntries.map((entry) => entry.label),
      datasets: [
        {
          label: "Measured value",
          data: numericInsightEntries.map((entry) => entry.value),
          backgroundColor: "rgba(52, 179, 160, 0.75)",
          borderColor: "rgba(52, 179, 160, 1)",
          borderRadius: 12,
          hoverBackgroundColor: "rgba(52, 179, 160, 0.9)",
        },
      ],
    };
  }, [numericInsightEntries]);

  const insightChartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Quantitative insights",
          color: "#1f3b57",
          font: { size: 16, weight: "bold" },
        },
        tooltip: {
          backgroundColor: "rgba(31, 59, 87, 0.95)",
          titleColor: "#e3f2ff",
          bodyColor: "#f8fbff",
          padding: 12,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148, 163, 184, 0.3)" },
          ticks: { color: "#1f3b57" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#4a6a8c" },
        },
      },
    }),
    []
  );

  const timelineChartData = useMemo(() => {
    if (!reports.length) return null;
    const chronological = [...reports].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const labels = chronological.map((report) =>
      new Date(report.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );

    const insightCounts = chronological.map((report) => report.insights?.length || 0);
    const summaryLengths = chronological.map((report) => wordCount(report.ai_summary));

    return {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Insights captured",
          data: insightCounts,
          borderRadius: 12,
          backgroundColor: "rgba(52, 179, 160, 0.65)",
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Summary depth (words)",
          data: summaryLengths,
          borderColor: "rgba(31, 59, 87, 1)",
          backgroundColor: "rgba(31, 59, 87, 0.12)",
          tension: 0.4,
          fill: true,
          yAxisID: "y1",
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [reports]);

  const timelineChartOptions = useMemo(
    () => ({
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#1f3b57", usePointStyle: true },
        },
        title: {
          display: true,
          text: "Report cadence overview",
          color: "#1f3b57",
          font: { size: 16, weight: "bold" },
        },
        tooltip: {
          backgroundColor: "rgba(31, 59, 87, 0.95)",
          titleColor: "#e3f2ff",
          bodyColor: "#f8fbff",
          padding: 12,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          ticks: { color: "#195a64" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#1f3b57" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#4a6a8c" },
        },
      },
    }),
    []
  );

  const carePlanSuggestions = useMemo(() => deriveCarePlan(selectedReport), [selectedReport]);

  const patientTakeaways = useMemo(() => {
    if (!selectedReport?.ai_summary) return [];
    const sentences = selectedReport.ai_summary
      .split(/[\n.]/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (!sentences.length) return [];
    return sentences.slice(0, 3);
  }, [selectedReport]);

  const overviewCards = useMemo(() => {
    const baseCards = [
      {
        id: "reports",
        label: "Reports processed",
        icon: DocumentChartBarIcon,
        value: aggregatedMetrics ? aggregatedMetrics.totalReports.toLocaleString("en-US") : "0",
        helper: aggregatedMetrics?.latestReport
          ? `Latest update ${formatDateTime(aggregatedMetrics.latestReport.created_at)}`
          : "Upload reports to start building the timeline.",
      },
      {
        id: "insights",
        label: "Insights captured",
        icon: SparklesIcon,
        value: aggregatedMetrics
          ? aggregatedMetrics.totalInsights.toLocaleString("en-US")
          : "0",
        helper: aggregatedMetrics
          ? `${aggregatedMetrics.averageInsights.toFixed(1)} per report on average`
          : "Insights will appear once the AI analyses your uploads.",
      },
      {
        id: "summary-depth",
        label: "Narrative depth",
        icon: ClipboardDocumentListIcon,
        value: aggregatedMetrics
          ? `${Math.round(aggregatedMetrics.averageSummaryWords).toLocaleString("en-US")} words`
          : "—",
        helper: aggregatedMetrics
          ? `Richest report: ${aggregatedMetrics.richestReportName} (${aggregatedMetrics.richestReportWords.toLocaleString(
              "en-US"
            )} words)`
          : "Summaries describe the clinical findings in patient-friendly language.",
      },
      {
        id: "focus-areas",
        label: "Focus areas",
        icon: ShieldCheckIcon,
        value: aggregatedMetrics ? aggregatedMetrics.focusAreaCount.toLocaleString("en-US") : "0",
        helper: aggregatedMetrics
          ? "Unique condition themes surfaced across reports."
          : "Insights will be grouped into focus areas automatically.",
      },
    ];

    return baseCards;
  }, [aggregatedMetrics]);

  const handleExport = useCallback(
    (mode) => {
      if (typeof window === "undefined") return;

      const reportsToExport =
        mode === "all"
          ? reports
          : selectedReport
            ? [selectedReport]
            : [];

      if (!reportsToExport.length) {
        setExportFeedback("No reports available to export yet.");
        return;
      }

      const exportWindow = window.open("", "_blank", "noopener,noreferrer,width=1080,height=720");
      if (!exportWindow) {
        setExportFeedback("Pop-ups are blocked. Please allow pop-ups to export PDFs.");
        return;
      }

      const origin = window.location.origin || "";
      const logoUrl = `${origin}/med-analyzr-ai-logo.png`;
      const generatedAt = formatDateTime(new Date().toISOString());
      const title =
        mode === "all"
          ? "Med Analyzr AI — Full Report Portfolio"
          : `Med Analyzr AI — ${reportsToExport[0].report_name || "Selected report"}`;

      const overviewSection =
        mode === "all" && aggregatedMetrics
          ? `
            <section class="overview">
              <h2>Portfolio overview</h2>
              <div class="grid">
                <div><span class="label">Reports processed</span><span class="value">${aggregatedMetrics.totalReports.toLocaleString(
                  "en-US"
                )}</span></div>
                <div><span class="label">Insights collected</span><span class="value">${aggregatedMetrics.totalInsights.toLocaleString(
                  "en-US"
                )}</span></div>
                <div><span class="label">Avg. narrative length</span><span class="value">${Math.round(
                  aggregatedMetrics.averageSummaryWords
                ).toLocaleString("en-US")} words</span></div>
                <div><span class="label">Focus areas</span><span class="value">${aggregatedMetrics.focusAreaCount.toLocaleString(
                  "en-US"
                )}</span></div>
              </div>
            </section>
          `
          : "";

      const printableReports = reportsToExport
        .map((report, index) => {
          const insightList = (report.insights || [])
            .map(
              (insight) => `<li>
                <span class="dot"></span>
                <span>${escapeHtml(insight)}</span>
              </li>`
            )
            .join("");

          const summaryParagraphs = report.ai_summary
            ? report.ai_summary
                .split(/\n{2,}/)
                .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
                .join("")
            : '<p class="placeholder">No AI summary available for this report yet.</p>';

          const extracted = report.extracted_text
            ? escapeHtml(report.extracted_text)
            : "Raw OCR output will appear after processing.";

          return `
            <section class="report">
              <header>
                <h2>${escapeHtml(report.report_name || `Report ${index + 1}`)}</h2>
                <p class="meta">Analysed ${escapeHtml(formatDateTime(report.created_at))}</p>
              </header>
              <div class="summary">
                <h3>AI narrative</h3>
                ${summaryParagraphs}
              </div>
              <div class="insights">
                <h3>Insights for clinicians</h3>
                ${
                  insightList
                    ? `<ul>${insightList}</ul>`
                    : '<p class="placeholder">No insights captured yet.</p>'
                }
              </div>
              <div class="extracted">
                <h3>Source transcript</h3>
                <pre>${extracted}</pre>
              </div>
            </section>
          `;
        })
        .join("");

      exportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            :root {
              color-scheme: light;
              font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            body {
              margin: 0;
              padding: 32px;
              background: #f7fbff;
              color: #1f3b57;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 16px;
              margin-bottom: 24px;
            }
            .brand img {
              width: 80px;
              height: auto;
            }
            .brand h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .brand p {
              margin: 4px 0 0;
              font-size: 12px;
              color: #4a6a8c;
            }
            .overview {
              border: 1px solid rgba(31, 59, 87, 0.1);
              border-radius: 18px;
              background: #ffffff;
              padding: 20px;
              margin-bottom: 32px;
            }
            .overview h2 {
              margin: 0 0 16px;
              font-size: 18px;
            }
            .overview .grid {
              display: grid;
              gap: 16px;
              grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            }
            .overview .label {
              display: block;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #4a6a8c;
              margin-bottom: 6px;
            }
            .overview .value {
              font-size: 20px;
              font-weight: 600;
              color: #1f3b57;
            }
            .report {
              border: 1px solid rgba(31, 59, 87, 0.1);
              border-radius: 20px;
              background: #ffffff;
              padding: 24px;
              margin-bottom: 28px;
              box-shadow: 0 16px 40px rgba(14, 63, 92, 0.08);
            }
            .report header h2 {
              margin: 0;
              font-size: 20px;
              font-weight: 600;
            }
            .report header .meta {
              margin-top: 6px;
              font-size: 12px;
              color: #4a6a8c;
            }
            .summary, .insights, .extracted {
              margin-top: 20px;
            }
            .summary h3,
            .insights h3,
            .extracted h3 {
              font-size: 16px;
              margin-bottom: 10px;
              color: #1f3b57;
            }
            .summary p {
              margin: 0 0 10px;
              font-size: 14px;
              line-height: 1.6;
              color: #1f3b57;
            }
            .insights ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .insights li {
              display: flex;
              gap: 10px;
              padding: 10px 12px;
              border: 1px solid rgba(52, 179, 160, 0.2);
              border-radius: 14px;
              background: rgba(231, 250, 246, 0.6);
              font-size: 13px;
              margin-bottom: 8px;
            }
            .insights li .dot {
              width: 8px;
              height: 8px;
              margin-top: 4px;
              border-radius: 999px;
              background: rgba(52, 179, 160, 1);
              flex-shrink: 0;
            }
            .extracted pre {
              margin: 0;
              padding: 14px;
              background: rgba(15, 59, 74, 0.05);
              border-radius: 12px;
              font-size: 12px;
              line-height: 1.5;
              color: #1f3b57;
              white-space: pre-wrap;
            }
            .placeholder {
              font-size: 13px;
              color: #4a6a8c;
            }
            @media print {
              body {
                padding: 16mm;
                background: #ffffff;
              }
              .report {
                box-shadow: none;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="brand">
            <img src="${logoUrl}" alt="Med Analyzr AI logo" />
            <div>
              <h1>${title}</h1>
              <p>Generated ${generatedAt}</p>
            </div>
          </div>
          ${overviewSection}
          ${printableReports}
        </body>
        </html>
      `);

      exportWindow.document.close();
      exportWindow.focus();
      exportWindow.onload = () => {
        setTimeout(() => {
          exportWindow.print();
        }, 350);
      };
      setExportFeedback("Preparing PDF export… your browser will open the print dialogue.");
    },
    [aggregatedMetrics, reports, selectedReport]
  );

  const activeReportFacts = useMemo(() => {
    if (!selectedReport) return [];
    return [
      {
        label: "Report title",
        value: selectedReport.report_name || "—",
      },
      {
        label: "Analysed on",
        value: formatDateTime(selectedReport.created_at),
      },
      {
        label: "Insights captured",
        value: `${selectedReport.insights?.length || 0}`,
      },
      {
        label: "Narrative length",
        value: `${wordCount(selectedReport.ai_summary).toLocaleString("en-US")} words`,
      },
    ];
  }, [selectedReport]);

  return (
    <>
      <Head>
        <title>Reports | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <Navbar />
        <main className="section-stack">
            <section className="section-card p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal/70">
                    Reports intelligence centre
                  </p>
                  <h1 className="text-3xl font-semibold text-ocean md:text-4xl">
                    Comprehensive medical reporting and export workspace
                  </h1>
                  <p className="text-sm text-ocean/70">
                    Track AI narratives, surface quantitative insights, and produce branded PDFs for clinical
                    collaboration. Patients and doctors share a unified view of progress and next steps.
                  </p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleExport("selected")}
                    className="flex items-center justify-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={!selectedReport}
                  >
                    <DocumentArrowDownIcon className="h-5 w-5" />
                    Export selected report
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("all")}
                    className="flex items-center justify-center gap-2 rounded-full border border-teal/40 px-6 py-3 text-sm font-semibold text-teal shadow-lg transition hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={!reports.length}
                  >
                    <DocumentChartBarIcon className="h-5 w-5" />
                    Export all reports
                  </button>
                </div>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {overviewCards.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.id}
                      className="section-card section-card--compact transition hover:-translate-y-1"
                    >
                      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ocean/60">
                        <Icon className="h-5 w-5 text-teal" />
                        {metric.label}
                      </div>
                      <p className="mt-4 text-2xl font-semibold text-ocean">{metric.value}</p>
                      <p className="mt-2 text-xs text-ocean/60">{metric.helper}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {(error || exportFeedback) && (
              <div className="rounded-3xl border border-teal/30 bg-white/90 px-4 py-3 text-sm text-ocean/70 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{error || exportFeedback}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setExportFeedback("");
                    }}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-teal transition hover:text-teal/80"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <section className="grid gap-6 xl:grid-cols-[1.8fr,1fr]">
              <div className="space-y-6">
                <section className="section-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal/70">
                        Active AI narrative
                      </p>
                      <h2 className="text-2xl font-semibold text-ocean">
                        {selectedReport?.report_name || "Select a report to explore"}
                      </h2>
                      <p className="text-xs text-ocean/60">
                        {selectedReport
                          ? `Generated ${formatDateTime(selectedReport.created_at)}`
                          : "Choose a report from the list to see full details."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 text-sm leading-relaxed text-ocean/80">
                    {loading ? (
                      <p className="text-ocean/60">Loading narratives and insights…</p>
                    ) : selectedReport ? (
                      <AiSummary summary={selectedReport.ai_summary} />
                    ) : (
                      <p className="text-ocean/60">
                        Upload medical records to generate AI narratives, insights, and export-ready reports.
                      </p>
                    )}
                  </div>
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/80 bg-white/90 p-4 text-xs uppercase tracking-[0.2em] text-ocean/60">
                      <p>Patient-ready excerpts</p>
                      <ul className="mt-3 space-y-2 text-[13px] normal-case tracking-normal text-ocean/80">
                        {patientTakeaways.length ? (
                          patientTakeaways.map((item) => (
                            <li key={item} className="rounded-xl bg-teal/10 px-3 py-2">
                              {item}
                            </li>
                          ))
                        ) : (
                          <li className="rounded-xl bg-white px-3 py-2 text-ocean/50">
                            Key excerpts appear once the AI narrative is available.
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/90 p-4 text-xs uppercase tracking-[0.2em] text-ocean/60">
                      <p>Care coordination checklist</p>
                      <ul className="mt-3 space-y-2 text-[13px] normal-case tracking-normal text-ocean/80">
                        {carePlanSuggestions.map((item) => (
                          <li key={item} className="rounded-xl bg-white px-3 py-2 shadow-soft">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="section-card p-6">
                    {timelineChartData ? (
                      <Bar data={timelineChartData} options={timelineChartOptions} height={220} />
                    ) : (
                      <p className="text-sm text-ocean/60">
                        Once multiple reports are analysed, you will see a combined view of insight counts and summary
                        depth over time.
                      </p>
                    )}
                  </div>
                  <div className="section-card p-6">
                    {insightChartData ? (
                      <Bar data={insightChartData} options={insightChartOptions} height={220} />
                    ) : (
                      <p className="text-sm text-ocean/60">
                        Numeric insights (e.g., lab values or vitals) appear here for the active report, making it easy
                        to visualise key measures.
                      </p>
                    )}
                  </div>
                </section>

                <section className="section-card space-y-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-ocean">Source transcript</h3>
                      <p className="text-xs text-ocean/60">
                        Clinicians can verify the AI interpretation by reviewing the original extracted text.
                      </p>
                    </div>
                  </div>
                  <pre className="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/80 bg-white/90 p-4 text-sm leading-relaxed text-ocean/80">
                    {selectedReport?.extracted_text || "Select a report to view raw OCR output."}
                  </pre>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="section-card space-y-4 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ocean">Report library</h3>
                      <p className="text-xs text-ocean/60">
                        Choose a report to sync insights, charts, and export details.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="flex items-center gap-2 rounded-full border border-white/80 px-3 py-1.5 text-xs font-medium text-ocean/80 transition hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={refreshing || loading}
                    >
                      <ArrowPathIcon className={clsx("h-4 w-4", (refreshing || loading) && "animate-spin")} />
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {reports.length ? (
                      reports.map((report) => {
                        const isActive = selectedReport?.id === report.id;
                        return (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => setSelectedReport(report)}
                            className={clsx(
                              "w-full rounded-2xl border px-4 py-3 text-left text-sm transition",
                              isActive
                                ? "border-teal/60 bg-teal/10 text-ocean shadow-lg"
                                : "border-white/80 bg-white/90 text-ocean/80 hover:border-teal/40 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-ocean">{report.report_name}</p>
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
                      <p className="text-sm text-ocean/60">
                        Upload your first report to unlock AI narratives, insights, and export-ready dossiers.
                      </p>
                    )}
                  </div>
                </section>

                <section className="section-card space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-ocean">Active report insights</h3>
                  <ul className="space-y-2 text-sm text-ocean/80">
                    {selectedInsightDetails.length ? (
                      selectedInsightDetails.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-2xl border border-white/80 bg-white/90 px-4 py-2 shadow-soft"
                        >
                          <p className="font-medium text-ocean">{item.label}</p>
                          <p className="text-xs text-ocean/60">{item.raw}</p>
                        </li>
                      ))
                    ) : (
                      <li className="rounded-2xl border border-dashed border-white/70 bg-white/60 px-4 py-3 text-ocean/50">
                        Insights will appear after the AI completes its clinical interpretation.
                      </li>
                    )}
                  </ul>
                </section>

                <section className="section-card space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-ocean">Report at a glance</h3>
                  <dl className="space-y-3 text-sm text-ocean/80">
                    {activeReportFacts.length ? (
                      activeReportFacts.map((fact) => (
                        <div key={fact.label}>
                          <dt className="text-xs uppercase tracking-[0.2em] text-ocean/50">{fact.label}</dt>
                          <dd className="text-ocean">{fact.value}</dd>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ocean/60">
                        Selecting a report reveals key metadata ready for the export template.
                      </p>
                    )}
                  </dl>
                </section>
              </aside>
            </section>
          </main>
        </PageShell>
    </>
  );
}
