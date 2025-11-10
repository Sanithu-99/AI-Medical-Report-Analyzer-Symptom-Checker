import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import {
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import UploadBox from "@/components/UploadBox";
import ChartSection from "@/components/ChartSection";
import AiSummary from "@/components/AiSummary";
import PageShell from "@/components/PageShell";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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

const HEALTH_CATEGORY_KEYWORDS = [
  {
    id: "cardiovascular",
    label: "Cardiovascular",
    keywords: ["cardio", "cardiac", "blood pressure", "hypertension", "cholesterol", "lipid", "arrhythm", "heart"],
  },
  {
    id: "metabolic",
    label: "Metabolic & Endocrine",
    keywords: ["glucose", "insulin", "diabetes", "endocrine", "thyroid", "metabolic", "hba1c"],
  },
  {
    id: "respiratory",
    label: "Respiratory",
    keywords: ["lung", "pulmonary", "respiratory", "oxygen", "asthma", "copd", "bronch"],
  },
  {
    id: "hematology",
    label: "Hematology",
    keywords: ["hemoglobin", "anemia", "hematocrit", "platelet", "blood count", "leukocyte", "wbc", "rbc"],
  },
  {
    id: "renal",
    label: "Renal & Electrolytes",
    keywords: ["renal", "kidney", "creatinine", "gfr", "urea", "electrolyte", "potassium", "sodium"],
  },
  {
    id: "immunology",
    label: "Immune & Infection",
    keywords: ["infection", "inflammatory", "immune", "sepsis", "antibody", "fever"],
  },
  {
    id: "oncology",
    label: "Imaging & Oncology",
    keywords: ["lesion", "tumor", "mass", "nodule", "malignant", "oncology", "biopsy", "ct", "mri"],
  },
  {
    id: "neurology",
    label: "Neurology",
    keywords: ["neuro", "brain", "stroke", "cognitive", "seizure", "neurolog"],
  },
  {
    id: "general",
    label: "General Health",
    keywords: [],
  },
];

const RISK_LEVEL_LABELS = {
  critical: "Critical",
  high: "High risk",
  moderate: "Moderate",
  low: "Low",
  reassuring: "Reassuring",
};

const RISK_LEVEL_DESCRIPTORS = {
  critical: "Requires urgent escalation and focused clinical intervention.",
  high: "Significant findings — schedule prompt clinical follow-up.",
  moderate: "Monitor closely and align follow-up testing with the care team.",
  low: "Mild variances detected — continue watchful monitoring.",
  reassuring: "Findings are within expected ranges for now.",
};

const clampValue = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const riskToLevel = (risk) => {
  if (risk >= 0.85) return "critical";
  if (risk >= 0.7) return "high";
  if (risk >= 0.55) return "moderate";
  if (risk >= 0.4) return "low";
  return "reassuring";
};

const parseConfidenceValue = (text) => {
  if (!text) return null;
  const percentMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (percentMatch) {
    const percent = Number(percentMatch[1]);
    if (!Number.isNaN(percent)) {
      return clampValue(percent / 100);
    }
  }
  const decimalMatch = text.match(/(?:^|[\s:])([0-1](?:\.\d+)?)(?=\D|$)/);
  if (decimalMatch) {
    const value = Number(decimalMatch[1]);
    if (!Number.isNaN(value)) {
      return clampValue(value);
    }
  }
  return null;
};

const findCategoryForText = (text) => {
  const lowered = (text || "").toLowerCase();
  for (const category of HEALTH_CATEGORY_KEYWORDS) {
    if (category.keywords.some((keyword) => lowered.includes(keyword))) {
      return category;
    }
  }
  return HEALTH_CATEGORY_KEYWORDS[HEALTH_CATEGORY_KEYWORDS.length - 1];
};

const detectSeverity = (text) => {
  const lowered = (text || "").toLowerCase();
  const severityMatrix = [
    { id: "critical", risk: 0.92, tokens: ["critical", "life-threatening", "emergency", "septic", "acute failure"] },
    { id: "high", risk: 0.78, tokens: ["severe", "marked", "significant", "positive for", "worsening", "aggressive"] },
    {
      id: "moderate",
      risk: 0.62,
      tokens: ["elevated", "abnormal", "decreased", "increased", "concerning", "needs further", "follow-up"],
    },
    { id: "low", risk: 0.45, tokens: ["mild", "slight", "borderline", "monitor", "review", "surveillance"] },
  ];
  const reassuringTokens = [
    "normal",
    "within normal",
    "unremarkable",
    "no significant",
    "stable",
    "resolved",
    "negative",
    "benign",
  ];
  const improvingTokens = ["improved", "improving", "resolving", "decreased", "reduced"];

  let matched = severityMatrix.find((entry) =>
    entry.tokens.some((token) => lowered.includes(token))
  );
  let risk = matched?.risk ?? 0.55;

  if (reassuringTokens.some((token) => lowered.includes(token))) {
    if (!matched || matched.id === "low" || risk < 0.6) {
      risk = Math.min(risk, 0.3);
    } else {
      risk = Math.max(0.4, risk - 0.15);
    }
  }

  if (improvingTokens.some((token) => lowered.includes(token))) {
    risk = Math.max(0.25, risk - 0.1);
  }

  const probability = parseConfidenceValue(text);
  if (probability !== null) {
    risk = Math.max(risk, probability);
  }

  risk = clampValue(risk, 0.05, 0.98);
  return { risk, level: riskToLevel(risk) };
};

const scoreInsightText = (text) => {
  if (!text) return null;
  const label = text.includes(":") ? text.split(":")[0].trim() : text.trim().split(/[.]/)[0].trim();
  const category = findCategoryForText(text);
  const severity = detectSeverity(text);
  return {
    text: text.trim(),
    label: label || category.label,
    category,
    risk: severity.risk,
    level: severity.level,
    descriptor: RISK_LEVEL_DESCRIPTORS[severity.level],
  };
};

const scoreSummaryText = (summary) => {
  if (!summary) return null;
  const sentences = summary.split(/(?<=[.!?])\s+/);
  let highest = null;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const scored = scoreInsightText(trimmed);
    if (!scored) continue;
    if (!highest || scored.risk > highest.risk) {
      highest = { ...scored, label: "Summary insight" };
    }
  }
  if (!highest) return null;
  return { ...highest, category: findCategoryForText(highest.text), isSummary: true };
};

const truncateText = (value, limit = 160) => {
  if (!value) return "";
  return value.length > limit ? `${value.slice(0, limit - 3).trim()}...` : value;
};

const formatErrorDetail = (detail, fallback) => {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.detail || (Array.isArray(item?.loc) ? item.loc.join(" > ") : JSON.stringify(item)))
      .join(" ");
  }
  if (typeof detail === "object") {
    return detail.msg || detail.detail || JSON.stringify(detail);
  }
  return fallback;
};

const getErrorMessage = (error, fallback) => formatErrorDetail(error?.response?.data?.detail, fallback);

const getScoreBadgeClass = (score) => {
  if (typeof score !== "number") {
    return "border-white/80 bg-white/90 text-ocean/60";
  }
  if (score >= 85) {
    return "border-teal/40 bg-teal/10 text-teal";
  }
  if (score >= 70) {
    return "border-sand/80 bg-sand/20 text-ocean/70";
  }
  if (score >= 55) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-600";
};

const riskBadgeClass = (level) =>
  ({
    critical: "border-rose-200 bg-rose-50 text-rose-600",
    high: "border-amber-200 bg-amber-50 text-amber-700",
    moderate: "border-sand/80 bg-sand/20 text-ocean/70",
    low: "border-teal/30 bg-teal/10 text-teal",
    reassuring: "border-teal/40 bg-teal/10 text-teal",
  }[level] || "border-white/80 bg-white text-ocean/70");

const riskCardClass = (level) =>
  ({
    critical: "border-rose-200 bg-rose-50",
    high: "border-rose-200 bg-rose-50",
    moderate: "border-amber-200 bg-amber-50",
    low: "border-teal/30 bg-teal/10",
    reassuring: "border-teal/30 bg-teal/10",
  }[level] || "border-white/80 bg-white");

const riskCardHeadingClass = (level) =>
  ({
    critical: "text-rose-700",
    high: "text-rose-700",
    moderate: "text-amber-700",
    low: "text-teal-700",
    reassuring: "text-teal-700",
  }[level] || "text-ocean");

const riskCardBodyClass = (level) =>
  ({
    critical: "text-rose-600",
    high: "text-rose-600",
    moderate: "text-amber-700",
    low: "text-teal-700",
    reassuring: "text-teal-700",
  }[level] || "text-ocean/80");

const riskLevelLabel = (level) => RISK_LEVEL_LABELS[level] || "Monitor";

const buildHealthSnapshot = (reports) => {
  if (!reports?.length) {
    return {
      hasData: false,
      score: null,
      grade: "No reports yet",
      summary: "Upload reports to generate a consolidated health score.",
      categories: [],
      flaggedInsights: [],
      trend: null,
      timeline: [],
      chartData: [],
    };
  }

  let totalRisk = 0;
  let totalWeight = 0;
  const categoryMap = new Map();
  const insightDetails = [];
  const timeline = [];

  const chronological = [...reports].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  chronological.forEach((report) => {
    const context = {
      reportId: report.id,
      reportName: report.report_name,
      createdAt: report.created_at,
    };
    const perReportRisks = [];

    for (const insightText of report.insights || []) {
      const scored = scoreInsightText(insightText);
      if (!scored) continue;
      const detail = { ...scored, ...context };
      insightDetails.push(detail);
      perReportRisks.push(detail.risk);
      totalRisk += detail.risk;
      totalWeight += 1;

      const existingCategory = categoryMap.get(detail.category.id);
      if (existingCategory) {
        existingCategory.riskSum += detail.risk;
        existingCategory.count += 1;
        if (!existingCategory.worst || detail.risk > existingCategory.worst.risk) {
          existingCategory.worst = detail;
        }
      } else {
        categoryMap.set(detail.category.id, {
          id: detail.category.id,
          label: detail.category.label,
          riskSum: detail.risk,
          count: 1,
          worst: detail,
        });
      }
    }

    const summaryDetail = scoreSummaryText(report.ai_summary);
    if (summaryDetail) {
      const detail = { ...summaryDetail, ...context };
      insightDetails.push(detail);
      perReportRisks.push(detail.risk);
      totalRisk += detail.risk;
      totalWeight += 1;

      const existingCategory = categoryMap.get(detail.category.id);
      if (existingCategory) {
        existingCategory.riskSum += detail.risk;
        existingCategory.count += 1;
        if (!existingCategory.worst || detail.risk > existingCategory.worst.risk) {
          existingCategory.worst = detail;
        }
      } else {
        categoryMap.set(detail.category.id, {
          id: detail.category.id,
          label: detail.category.label,
          riskSum: detail.risk,
          count: 1,
          worst: detail,
        });
      }
    }

    if (perReportRisks.length > 0) {
      const averageReportRisk =
        perReportRisks.reduce((accumulator, value) => accumulator + value, 0) /
        perReportRisks.length;
      timeline.push({
        ...context,
        risk: averageReportRisk,
        score: Math.round((1 - clampValue(averageReportRisk)) * 100),
      });
    }
  });

  if (totalWeight === 0) {
    return {
      hasData: false,
      score: null,
      grade: "Awaiting insights",
      summary: "Once AI generates findings, aggregated scoring will appear here.",
      categories: [],
      flaggedInsights: [],
      trend: null,
      timeline,
      chartData: [],
    };
  }

  const averageRisk = totalRisk / totalWeight;
  const normalizedScore = Math.round((1 - clampValue(averageRisk)) * 100);
  const grade =
    normalizedScore >= 85
      ? "Optimal"
      : normalizedScore >= 70
      ? "Stable"
      : normalizedScore >= 55
      ? "Needs review"
      : "High risk";
  const summary =
    grade === "Optimal"
      ? "Reports trend reassuring with no high-risk alerts."
      : grade === "Stable"
      ? "Overall health signals remain steady. Maintain routine monitoring."
      : grade === "Needs review"
      ? "Several findings warrant closer clinical attention."
      : "Critical signals detected—coordinate an urgent clinician review.";

  const categories = Array.from(categoryMap.values())
    .map((category) => {
      const averageCategoryRisk = category.riskSum / category.count;
      const level = riskToLevel(averageCategoryRisk);
      return {
        id: category.id,
        label: category.label,
        averageRisk: averageCategoryRisk,
        score: Math.round((1 - clampValue(averageCategoryRisk)) * 100),
        level,
        descriptor: RISK_LEVEL_DESCRIPTORS[level],
        worst: category.worst,
      };
    })
    .sort((a, b) => a.score - b.score);

  const flaggedInsights = insightDetails
    .filter((detail) => detail.level !== "reassuring")
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 4);

  let trend = null;
  if (timeline.length >= 2) {
    const previous = timeline[timeline.length - 2];
    const latest = timeline[timeline.length - 1];
    const deltaRisk = latest.risk - previous.risk;
    trend = {
      direction: deltaRisk > 0.04 ? "worsening" : deltaRisk < -0.04 ? "improving" : "stable",
      deltaRisk,
      deltaScore: latest.score - previous.score,
      referenceReportName: previous.reportName,
      referenceCreatedAt: previous.createdAt,
    };
  }

  const chartData = categories.map((category) => ({
    label: category.label,
    value: category.score,
  }));

  return {
    hasData: true,
    score: normalizedScore,
    grade,
    summary,
    categories,
    flaggedInsights,
    trend,
    timeline,
    chartData,
  };
};

export default function Dashboard() {
  const router = useRouter();
  const { user, status: authStatus, plan } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailTab, setDetailTab] = useState(detailTabs[0].id);
  const [symptoms, setSymptoms] = useState("");
  const [symptomAnalysis, setSymptomAnalysis] = useState(null);
  const [symptomConditions, setSymptomConditions] = useState([]);
  const [symptomStatus, setSymptomStatus] = useState("");
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomModalOpen, setSymptomModalOpen] = useState(false);
  const [notification, setNotification] = useState("");
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState(null);
  const [aiDiagnosisStatus, setAiDiagnosisStatus] = useState("idle");
  const [aiDiagnosisError, setAiDiagnosisError] = useState("");
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiAdviceStatus, setAiAdviceStatus] = useState("idle");
  const [aiAdviceError, setAiAdviceError] = useState("");
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [healthScore, setHealthScore] = useState(null);
  const [healthScoreStatus, setHealthScoreStatus] = useState("idle");

  const fetchAdvice = useCallback(async () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setAiAdvice(null);
        setAiAdviceStatus("idle");
        setAiAdviceError("");
        return;
      }
    }

    setAiAdviceStatus("loading");
    setAiAdviceError("");
    try {
      const response = await api.get("/api/reports/advice");
      setAiAdvice(response.data || null);
      setAiAdviceStatus("ready");
    } catch (error) {
      const detail = getErrorMessage(error, "Unable to generate personalised advice right now.");
      setAiAdvice(null);
      setAiAdviceStatus("error");
      setAiAdviceError(detail);
    }
  }, []);

  const fetchHealthScore = useCallback(async () => {
    setHealthScoreStatus("loading");
    try {
      const response = await api.get("/api/reports/healthscore");
      setHealthScore(response.data ?? null);
      setHealthScoreStatus("ready");
    } catch (error) {
      console.warn("Failed to fetch health score", error);
      setHealthScore(null);
      setHealthScoreStatus("error");
    }
  }, []);

  const fetchDiagnosis = useCallback(async () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setAiDiagnosis(null);
        setAiDiagnosisStatus("idle");
        setAiDiagnosisError("");
        return;
      }
    }

    setAiDiagnosisStatus("loading");
    setAiDiagnosisError("");
    try {
      const response = await api.get("/api/reports/diagnosis");
      setAiDiagnosis(response.data || null);
      setAiDiagnosisStatus("ready");
    } catch (error) {
      const detail = getErrorMessage(error, "Unable to generate an AI diagnosis right now.");
      setAiDiagnosis(null);
      setAiDiagnosisStatus("error");
      setAiDiagnosisError(detail);
    }
  }, []);

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
      await Promise.all([fetchDiagnosis(), fetchAdvice(), fetchHealthScore()]);
    } catch (error) {
      console.warn("Failed to fetch reports", error);
      setNotification("We couldn't load your reports. Please try again.");
    }
  }, [fetchDiagnosis, fetchAdvice, fetchHealthScore]);

  useEffect(() => {
    if (authStatus !== "ready") return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.plan_expiry && plan === "individual") {
      router.replace("/pricing");
      return;
    }
    loadReports();
  }, [authStatus, user, plan, router, loadReports]);

  useEffect(() => {
    setSummaryExpanded(false);
  }, [selectedReport?.id, selectedReport?.ai_summary]);

  useEffect(() => {
    if (detailTab !== "summary") {
      setSummaryExpanded(false);
    }
  }, [detailTab]);

  useEffect(() => {
    const modalActive = symptomModalOpen || Boolean(selectedInsight) || scoreModalOpen;
    if (!modalActive) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (selectedInsight) {
          setSelectedInsight(null);
        }
        if (symptomModalOpen) {
          setSymptomModalOpen(false);
        }
        if (scoreModalOpen) {
          setScoreModalOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    let previousOverflow = "";
    if (typeof document !== "undefined") {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (typeof document !== "undefined") {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [symptomModalOpen, selectedInsight, scoreModalOpen]);

  const handleUpload = async (files) => {
    const fileArray = Array.isArray(files) ? files : [files].filter(Boolean);
    if (fileArray.length === 0) return;

    setUploading(true);
    setNotification("");

    try {
      const uploadResults = await Promise.all(
        fileArray.map(async (file) => {
          const formData = new FormData();
          formData.append("report_file", file);
          try {
            const response = await api.post("/api/reports/upload", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            return { status: "fulfilled", report: response.data, file };
          } catch (error) {
            const detail = getErrorMessage(error, "Upload failed. Please try again.");
            if (error.response?.status === 402) {
              setNotification(`${detail} Visit the pricing page to extend your quota.`);
            }
            return { status: "rejected", file, message: detail };
          }
        })
      );

      const uploadedReports = uploadResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.report);
      const failedUploads = uploadResults
        .filter((result) => result.status === "rejected")
        .map((result) => ({
          fileName: result.file?.name ?? "File",
          message: result.message,
        }));

      if (uploadedReports.length > 0) {
        setReports((previous) => {
          const existingIds = new Set(uploadedReports.map((report) => report.id));
          const filteredExisting = previous.filter((item) => !existingIds.has(item.id));
          const merged = [...uploadedReports, ...filteredExisting];
          return merged.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

        const latestUploaded = [...uploadedReports].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        if (latestUploaded) {
          setSelectedReport(latestUploaded);
        }
        setSummaryExpanded(false);
        setDetailTab("summary");
        await Promise.all([fetchDiagnosis(), fetchAdvice(), fetchHealthScore()]);
      }

      const notifications = [];
      if (uploadedReports.length > 0) {
        notifications.push(
          `${uploadedReports.length} report${
            uploadedReports.length === 1 ? "" : "s"
          } analysed successfully.`
        );
      }
      if (failedUploads.length > 0) {
        const failureDetails = failedUploads
          .map((failure) => `${failure.fileName}: ${failure.message}`)
          .join(" ");
        notifications.push(
          failedUploads.length === 1
            ? `Could not upload ${failureDetails}`
            : `Failed uploads — ${failureDetails}`
        );
      }
      if (notifications.length > 0) {
        setNotification(notifications.join(" "));
      }
    } catch (error) {
      console.error("Unhandled upload error", error);
      setNotification("We couldn't process the uploads right now. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleInsightSelect = (insight) => {
    setSelectedInsight(insight);
  };

  const handleInsightModalClose = () => {
    setSelectedInsight(null);
  };

  const openScoreModal = () => {
    setScoreModalOpen(true);
  };

  const closeScoreModal = () => {
    setScoreModalOpen(false);
  };

  const handleSymptomCheck = async (event) => {
    event.preventDefault();
    if (!symptoms.trim()) return;

    setSymptomStatus("");
    setSymptomAnalysis(null);
    setSymptomConditions([]);
    setSymptomLoading(true);
    setSymptomModalOpen(false);
    try {
      const response = await api.post("/api/symptoms", { symptoms });
      const analysis = response.data?.analysis ?? null;
      const possible = response.data?.possible_conditions || [];
      setSymptomAnalysis(analysis);
      setSymptomConditions(possible);
      const triageSummary = analysis?.triage?.summary;
      setSymptomStatus(
        triageSummary ||
          (possible.length > 0
            ? "Symptom analysis ready."
            : "No strong matches found. Add timing, severity, or risk factors for sharper results.")
      );
      if (analysis) {
        setSymptomModalOpen(true);
      } else {
        setSymptomModalOpen(false);
      }
    } catch (error) {
      setSymptomAnalysis(null);
      setSymptomConditions([]);
      const detail = getErrorMessage(error, "Unable to analyse symptoms right now.");
      setSymptomStatus(detail);
      if (error.response?.status === 402) {
        setNotification(`${detail} Upgrade your plan to extend symptom checker usage.`);
      }
      setSymptomModalOpen(false);
    } finally {
      setSymptomLoading(false);
    }
  };

  const handleReportSelect = (report) => {
    setSelectedReport(report);
     setSummaryExpanded(false);
    setDetailTab("summary");
  };

  const handleDeleteReport = async (report, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (
      !window.confirm(
        "This action permanently deletes the report. It cannot be undone and will immediately adjust your health results and score accuracy. Continue?"
      )
    ) {
      return;
    }

    setDeletingReportId(report.id);
    setNotification("");
    try {
      await api.delete(`/api/reports/${report.id}`);
      setReports((previous) => {
        const updated = previous.filter((item) => item.id !== report.id);
        setSelectedReport((current) => {
          if (!current) return updated[0] ?? null;
          if (current.id === report.id) {
            return updated[0] ?? null;
          }
          const persisted = updated.find((item) => item.id === current.id);
          return persisted ?? (updated[0] ?? null);
        });
        return updated;
      });
      setDetailTab("summary");
      setNotification("Report removed permanently. Health insights refreshed.");
      await Promise.all([fetchDiagnosis(), fetchAdvice()]);
    } catch (error) {
      const detail = getErrorMessage(error, "Unable to remove the report right now.");
      setNotification(detail);
    } finally {
      setDeletingReportId("");
    }
  };

  const handleSecureDownload = async () => {
    if (!selectedReport) return;
    if (plan === "individual") {
      setNotification("Upgrade to Clinician or Institution to export or share secure links.");
      return;
    }
    try {
      const response = await api.get(`/api/reports/${selectedReport.id}/signed-url`);
      const relativeUrl = response.data?.url;
      if (!relativeUrl) throw new Error("Missing download URL");
      const base = api.defaults.baseURL || process.env.NEXT_PUBLIC_API_URL || window.location.origin;
      const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
      const downloadUrl = relativeUrl.startsWith("http") ? relativeUrl : `${normalizedBase}${relativeUrl}`;
      window.open(downloadUrl, "_blank", "noopener");
    } catch (error) {
      const detail = getErrorMessage(error, "Unable to create a secure download link right now.");
      setNotification(detail);
    }
  };

  const handleExportCsv = () => {
    if (!selectedReport) return;
    if (plan === "individual") {
      setNotification("Exporting is available on Clinician and Institution plans.");
      return;
    }
    const rows = [
      ["Report name", selectedReport.report_name],
      ["Created at", formatDateTime(selectedReport.created_at)],
      ["AI summary", selectedReport.ai_summary],
      ["De-identified text", selectedReport.extracted_text],
    ];
    (selectedReport.insights || []).forEach((insight, index) => {
      rows.push([`Insight ${index + 1}`, insight]);
    });
    const csv = rows
      .map((row) => row.map((cell = "") => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `med-analyzr-report-${selectedReport.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAllReports = async () => {
    if (reports.length === 0) {
      return;
    }
    if (
      !window.confirm(
        "Deleting all reports cannot be undone. Your health timeline, risk trends, and AI accuracy will reset. Do you want to proceed?"
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    setNotification("");
    try {
      const response = await api.delete("/api/reports");
      const removed = response.data?.deleted ?? 0;
      setReports([]);
      setSelectedReport(null);
      setSummaryExpanded(false);
      setDetailTab("summary");
      if (removed > 0) {
        setNotification(
          `${removed} report${removed === 1 ? "" : "s"} deleted. Upload new reports to restore health tracking.`
        );
      } else {
        setNotification("No reports were removed.");
      }
      await Promise.all([fetchDiagnosis(), fetchAdvice()]);
    } catch (error) {
      const detail = getErrorMessage(error, "Unable to delete reports right now.");
      setNotification(detail);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const summaryWordCount = useMemo(
    () => (selectedReport ? wordCount(selectedReport.ai_summary) : 0),
    [selectedReport]
  );
  const summaryHasOverflow = summaryWordCount > 180;
  const placeOverviewInSidebar = summaryExpanded && summaryHasOverflow;
  const metrics = useMemo(() => {
    const totalReports = reports.length;
    const totalInsights = reports.reduce(
      (accumulator, report) => accumulator + (report.insights?.length || 0),
      0
    );
    const latestReport = reports[0];
    const activeInsights = selectedReport?.insights?.length || 0;
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
        value:
          summaryWordCount > 0 ? `${summaryWordCount.toLocaleString("en-US")} words` : "—",
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
  }, [reports, selectedReport, summaryWordCount]);
  const totalReportsCount = useMemo(() => reports.length, [reports]);
  const totalInsightsCount = useMemo(
    () =>
      reports.reduce((accumulator, report) => accumulator + (report.insights?.length || 0), 0),
    [reports]
  );

  const overallHealth = useMemo(() => buildHealthSnapshot(reports), [reports]);
  const overallScoreBadgeClass = useMemo(
    () => getScoreBadgeClass(overallHealth.score),
    [overallHealth.score]
  );
  const timelineItems = useMemo(
    () => (overallHealth.timeline.length ? [...overallHealth.timeline].reverse() : []),
    [overallHealth.timeline]
  );
  const timelineChartData = useMemo(() => {
    if (!overallHealth.timeline.length) return [];
    return overallHealth.timeline.map((item) => ({
      label: formatDateTime(item.createdAt),
      value: item.score,
    }));
  }, [overallHealth.timeline]);
  const topCategoryBreakdown = useMemo(
    () => overallHealth.categories.slice(0, 4),
    [overallHealth.categories]
  );
  const recentScoreSnapshots = useMemo(() => {
    if (!overallHealth.timeline.length) return [];
    return [...overallHealth.timeline].slice(-4).reverse();
  }, [overallHealth.timeline]);

  const renderOverallHealth = (placement = "main") => {
    const isSidebar = placement === "sidebar";

    if (!overallHealth.hasData) {
      return (
        <section className="section-card section-card--muted text-sm text-ocean/60">
          Upload analysed reports to unlock the consolidated health score and trend insights for your care team.
        </section>
      );
    }

    if (isSidebar) {
      return (
        <section className="section-card section-card--compact space-y-5">
          <div className="space-y-3 rounded-3xl border border-white/80 bg-white/95 p-5 shadow-soft">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Health snapshot</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-ocean">{overallHealth.score}</span>
              <span className="text-xs uppercase tracking-[0.2em] text-ocean/40">/100</span>
            </div>
            <span
              className={clsx(
                "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                overallScoreBadgeClass
              )}
            >
              {overallHealth.grade}
            </span>
            <p className="text-xs leading-relaxed text-ocean/70">{truncateText(overallHealth.summary, 220)}</p>
            <button
              type="button"
              onClick={openScoreModal}
              className="mt-3 inline-flex w-fit items-center justify-center rounded-full border border-teal/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal transition hover:border-teal hover:bg-teal/10"
            >
              Explain my score
            </button>
          </div>

          {timelineItems.length > 0 && (
            <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-soft">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Recent trajectory</p>
              <ul className="mt-3 space-y-3 text-xs text-ocean/70">
                {timelineItems.slice(0, 3).map((item) => (
                  <li key={item.reportId || item.reportName} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ocean/90">{item.reportName}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ocean/40">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ocean">{item.score}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ocean/40">/100</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overallHealth.categories.length > 0 && (
            <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-soft">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Top risk domains</p>
              <div className="mt-3 space-y-3">
                {overallHealth.categories.slice(0, 3).map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ocean">{category.label}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ocean/40">
                        {riskLevelLabel(category.level)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ocean">{category.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="section-card">
        <div className="space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="w-full max-w-xs rounded-3xl border border-white/80 bg-white/95 p-6 shadow-soft sm:max-w-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">
                Overall health overview
              </p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-ocean">{overallHealth.score}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-ocean/50">/100</span>
              </div>
              <span
                className={clsx(
                  "mt-4 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                  overallScoreBadgeClass
                )}
              >
                {overallHealth.grade}
              </span>
              <p className="mt-4 text-sm leading-relaxed text-ocean/70">{overallHealth.summary}</p>
              <button
                type="button"
                onClick={openScoreModal}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal transition hover:border-teal hover:bg-teal/10"
              >
                Explain my score
              </button>
              {overallHealth.trend && (
                <div
                  className={clsx(
                    "mt-4 rounded-2xl border px-4 py-3 text-xs leading-relaxed",
                    overallHealth.trend.direction === "worsening"
                      ? "border-rose-200 bg-rose-50 text-rose-600"
                      : overallHealth.trend.direction === "improving"
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "border-white/80 bg-white/90 text-ocean/70"
                  )}
                >
                  {overallHealth.trend.direction === "worsening" && (
                    <span>
                      Latest report score decreased by{" "}
                      {Math.abs(overallHealth.trend.deltaScore).toFixed(1)} points compared to{" "}
                      {overallHealth.trend.referenceReportName || "the prior review"}. Intensify monitoring.
                    </span>
                  )}
                  {overallHealth.trend.direction === "improving" && (
                    <span>
                      Overall health improved by {Math.abs(overallHealth.trend.deltaScore).toFixed(1)} points since{" "}
                      {overallHealth.trend.referenceReportName || "the prior review"}. Maintain the current plan.
                    </span>
                  )}
                  {overallHealth.trend.direction === "stable" && (
                    <span>Health score remained stable across the last two reports.</span>
                  )}
                </div>
              )}
              {timelineItems.length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Report timeline</p>
                  <ul className="space-y-3">
                    {timelineItems.slice(0, 3).map((item) => (
                      <li
                        key={item.reportId || item.reportName}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/90 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-ocean">{item.reportName}</p>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/40">
                            {formatDateTime(item.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-ocean">{item.score}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-ocean/40">/100</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {overallHealth.categories.map((category) => (
                  <div
                    key={category.id}
                    className="rounded-3xl border border-white/80 bg-white/95 p-5 text-xs text-ocean/70 shadow-soft"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ocean">{category.label}</p>
                      <span
                        className={clsx(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                          riskBadgeClass(category.level)
                        )}
                      >
                        {riskLevelLabel(category.level)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-ocean/60">{category.descriptor}</p>
                    <div className="mt-4 h-2 w-full rounded-full bg-sand/40">
                      <div
                        className="h-2 rounded-full bg-teal transition-all"
                        style={{ width: `${Math.max(4, category.score)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-ocean/50">
                      <span>Health score</span>
                      <span>{category.score}/100</span>
                    </div>
                    {category.worst?.text && (
                      <p className="mt-3 text-sm leading-relaxed text-ocean/80">
                        {truncateText(category.worst.text, 140)}
                      </p>
                    )}
                  </div>
                ))}
                {overallHealth.categories.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-white/80 bg-white/60 p-5 text-sm text-ocean/60">
                    Insights will populate category tracking once available.
                  </div>
                )}
              </div>

              {overallHealth.chartData.length > 0 && (
                <div className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-soft">
                  <p className="text-sm font-semibold text-ocean">System health distribution</p>
                  <div className="mt-4 space-y-3 max-h-60 overflow-y-auto smooth-scroll-area pr-1">
                    {overallHealth.chartData.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-ocean/70">
                          <span>{item.label}</span>
                          <span>{item.value}/100</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-sand/40">
                          <div className="h-2 rounded-full bg-teal" style={{ width: `${Math.max(4, item.value)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 rounded-3xl border border-white/80 bg-white/95 p-6 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">HealthScore AI</p>
                  <h3 className="mt-1 text-xl font-semibold text-ocean">
                    {healthScore?.overall_health_score ?? "—"}/100
                  </h3>
                </div>
                {healthScore?.confidence && (
                  <span className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal">
                    {Math.round(healthScore.confidence * 100)}% confidence
                  </span>
                )}
              </div>
              {healthScoreStatus === "loading" && (
                <p className="mt-4 text-sm text-ocean/60">Calibrating personalised risk profile…</p>
              )}
              {healthScoreStatus === "error" && (
                <p className="mt-4 text-sm text-rose-500">
                  Unable to fetch the latest AI score. Refresh the page or upload a new report.
                </p>
              )}
              {healthScoreStatus === "ready" && healthScore && (
                <>
                  <div className="mt-4 space-y-2 text-sm text-ocean/70">
                    <p className="font-semibold text-ocean">Priority risks</p>
                    {healthScore.risk_factors?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {healthScore.risk_factors.map((risk) => (
                          <span
                            key={risk}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700"
                          >
                            {risk}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-ocean/50">No elevated risks detected.</p>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-ocean/70">
                    <p className="font-semibold text-ocean">Improvement plan</p>
                    <ul className="list-disc pl-5 text-xs leading-relaxed text-ocean/70">
                      {(healthScore.improvement_suggestions || ["Maintain your current care plan."]).map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 text-xs text-ocean/60">
                    {healthScore.reasoning ||
                      (plan === "individual"
                        ? "Upgrade to Clinician or Institution to unlock AI reasoning."
                        : "HealthScore explanation unavailable.")}
                  </p>
                </>
              )}
            </div>
          </div>

          {overallHealth.flaggedInsights.length > 0 && (
            <div className="rounded-3xl border border-white/80 bg-white/95 p-6 shadow-soft">
              <p className="text-sm font-semibold text-ocean">Key findings requiring review</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {overallHealth.flaggedInsights.map((item) => (
                  <button
                    type="button"
                    key={`${item.reportId}-${item.text}`}
                    onClick={() => handleInsightSelect(item)}
                    className={clsx(
                      "w-full rounded-2xl border px-4 py-3 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
                      riskCardClass(item.level)
                    )}
                    aria-label={`View details for ${item.category.label} finding`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={clsx(
                          "text-sm font-semibold",
                          riskCardHeadingClass(item.level)
                        )}
                      >
                        {item.category.label}
                      </p>
                      <span
                        className={clsx(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                          riskBadgeClass(item.level)
                        )}
                      >
                        {riskLevelLabel(item.level)}
                      </span>
                    </div>
                    <p
                      className={clsx(
                        "mt-2 text-sm leading-relaxed",
                        riskCardBodyClass(item.level)
                      )}
                    >
                      {truncateText(item.text, 180)}
                    </p>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-ocean/50">
                      {item.reportName} • {formatDateTime(item.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderAIDiagnosis = () => {
    const isLoading = aiDiagnosisStatus === "loading" || aiDiagnosisStatus === "idle";
    const diagnosisData = aiDiagnosis;
    const threshold = diagnosisData?.confidence_threshold ?? 0.96;
    const rawConfidence =
      typeof diagnosisData?.primary_confidence === "number" ? diagnosisData.primary_confidence : null;
    const confidencePercent = rawConfidence !== null ? Math.round(rawConfidence * 1000) / 10 : null;
    const meetsThreshold = Boolean(diagnosisData?.confidence_met_threshold && rawConfidence !== null);
    const cautionMessage = (() => {
      if (!diagnosisData) return "";
      if (diagnosisData.caution && diagnosisData.caution.trim()) {
        return diagnosisData.caution.trim();
      }
      if (!diagnosisData.confidence_met_threshold) {
        return `Confidence is below ${(threshold * 100).toFixed(0)}%. Please consult a doctor before relying on this signal.`;
      }
      return "";
    })();
    const supportingEvidence = diagnosisData?.supporting_evidence || [];
    const differentials = diagnosisData?.differentials || [];
    const showCaution = Boolean(cautionMessage);

    return (
      <section className="section-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">
              AI Differential
            </p>
            <h2 className="text-2xl font-semibold text-ocean">Aggregated diagnosis</h2>
            <p className="text-xs text-ocean/60">
              Synthesises recent reports to surface the leading condition.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchDiagnosis()}
            disabled={isLoading}
            className={clsx(
              "flex items-center gap-2 rounded-full border border-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
              isLoading ? "text-ocean/40" : "hover:border-teal hover:text-teal"
            )}
          >
            <ArrowPathIcon className={clsx("h-4 w-4", isLoading && "animate-spin text-ocean/40")} />
            Refresh
          </button>
        </div>
        <div className="mt-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-ocean/70">
              <ArrowPathIcon className="h-4 w-4 animate-spin text-teal" />
              <span>Running diagnosis across reports…</span>
            </div>
          ) : aiDiagnosisStatus === "error" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {aiDiagnosisError}
            </div>
          ) : diagnosisData ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-soft">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex-1 space-y-4">
                    <p className="text-sm leading-relaxed text-ocean/70">{diagnosisData.summary}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.2em] text-ocean/40">
                      <span>Reports analysed: {diagnosisData.report_count}</span>
                      {diagnosisData.generated_at && (
                        <span>Updated {formatDateTime(diagnosisData.generated_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full max-w-[240px] rounded-2xl border border-white/80 bg-white px-4 py-4 text-center text-sm text-ocean/70 shadow-soft">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Top condition</p>
                    <p className="mt-2 text-lg font-semibold text-ocean">
                      {diagnosisData.primary_condition || "No leading match yet"}
                    </p>
                    {confidencePercent !== null ? (
                      <>
                        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-ocean/50">Confidence</p>
                        <div className="mt-1 flex items-baseline justify-center gap-1">
                          <span className="text-3xl font-semibold text-ocean">
                            {confidencePercent.toFixed(1)}
                          </span>
                          <span className="text-sm text-ocean/50">%</span>
                        </div>
                        <span
                          className={clsx(
                            "mt-3 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                            meetsThreshold
                              ? "border-teal/40 bg-teal/10 text-teal"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          )}
                        >
                          {diagnosisData.primary_confidence_label ||
                            (meetsThreshold ? "On target" : "Below threshold")}
                        </span>
                      </>
                    ) : (
                      <p className="mt-3 text-xs leading-relaxed text-ocean/60">
                        Not enough data to score confidence yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {showCaution && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
                    <p>{cautionMessage}</p>
                  </div>
                </div>
              )}

              {supportingEvidence.length > 0 && (
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-xs text-ocean/70 shadow-soft">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Supporting signals</p>
                  <ul className="mt-2 space-y-1 leading-snug">
                    {supportingEvidence.map((item) => (
                      <li key={item} className="list-disc pl-4">
                        {truncateText(item, 160)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {differentials.length > 0 && (
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-xs text-ocean/70 shadow-soft">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Differential spread</p>
                  <div className="mt-3 space-y-3">
                    {differentials.map((item, index) => {
                      const rawPercent =
                        typeof item.confidence === "number"
                          ? Math.round(item.confidence * 1000) / 10
                          : 0;
                      const barPercent = Math.min(100, Math.max(4, rawPercent));
                      return (
                        <div key={`${item.condition}-${index}`} className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-ocean">{item.condition}</p>
                            <span className="text-ocean/60">
                              {rawPercent.toFixed(1)}% • {item.confidence_label}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-sand/40">
                            <div
                              className="h-1.5 rounded-full bg-teal"
                              style={{ width: `${barPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/60 bg-white/90 p-4 text-[11px] uppercase tracking-[0.2em] text-ocean/50 shadow-soft">
                <p>Safety reminder</p>
                <p className="mt-1 text-xs normal-case leading-snug text-ocean/60">
                  {diagnosisData.disclaimer}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-sm text-ocean/60">
              Diagnosis insights will appear once analysis completes.
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderAIAdvice = () => {
    const isLoading = aiAdviceStatus === "loading" || aiAdviceStatus === "idle";
    const adviceData = aiAdvice;
    const adviceItems = adviceData?.advice || [];
    const supportingEvidence = adviceData?.supporting_evidence || [];

    return (
      <section className="section-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">
              AI Wellness Guide
            </p>
            <h2 className="text-2xl font-semibold text-ocean">Personalised health advice</h2>
            <p className="text-xs text-ocean/60">
              Lifestyle and recovery tips tuned to the latest report signals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAdvice()}
            disabled={isLoading}
            className={clsx(
              "flex items-center gap-2 rounded-full border border-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
              isLoading ? "text-ocean/40" : "hover:border-teal hover:text-teal"
            )}
          >
            <ArrowPathIcon className={clsx("h-4 w-4", isLoading && "animate-spin text-ocean/40")} />
            Refresh
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-ocean/70">
              <ArrowPathIcon className="h-4 w-4 animate-spin text-teal" />
              <span>Curating habit priorities…</span>
            </div>
          ) : aiAdviceStatus === "error" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {aiAdviceError}
            </div>
          ) : adviceData ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-soft">
                <p className="text-sm leading-relaxed text-ocean/70">
                  {adviceData.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.2em] text-ocean/40">
                  <span>Reports analysed: {adviceData.report_count}</span>
                  {adviceData.generated_at && (
                    <span>Updated {formatDateTime(adviceData.generated_at)}</span>
                  )}
                </div>
              </div>

              {adviceItems.length > 0 && (
                <div className="space-y-4">
                  {adviceItems.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="rounded-3xl border border-white/80 bg-white/95 p-5 text-sm text-ocean/70 shadow-soft"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-teal">
                          <LightBulbIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-base font-semibold text-ocean">{item.title}</p>
                            {item.description && (
                              <p className="mt-1 text-sm text-ocean/60">{item.description}</p>
                            )}
                          </div>
                          {item.matched_keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-ocean/40">
                              {item.matched_keywords.map((keyword) => (
                                <span
                                  key={keyword}
                                  className="rounded-full border border-white/80 bg-white px-2 py-1"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.actions?.length > 0 && (
                            <ul className="space-y-2 text-sm leading-relaxed text-ocean/80">
                              {item.actions.map((action) => (
                                <li key={action} className="list-disc pl-5">
                                  {action}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {supportingEvidence.length > 0 && (
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-xs text-ocean/70 shadow-soft">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">
                    Signals referenced
                  </p>
                  <ul className="mt-2 space-y-1 leading-snug">
                    {supportingEvidence.map((item) => (
                      <li key={item} className="list-disc pl-4">
                        {truncateText(item, 160)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-white/60 bg-white/90 p-4 text-[11px] uppercase tracking-[0.2em] text-ocean/50 shadow-soft">
                <p>Stay clinical-first</p>
                <p className="mt-1 text-xs normal-case leading-snug text-ocean/60">
                  {adviceData.disclaimer}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-sm text-ocean/60">
              Advice will appear once reports are analysed.
            </div>
          )}
        </div>
      </section>
    );
  };

  const triageLevel = symptomAnalysis?.triage?.level || "insight";
  const triageCardStyles = {
    emergency: "border-rose-200 bg-rose-50",
    urgent: "border-amber-200 bg-amber-50",
    routine: "border-teal/30 bg-teal/5",
    insight: "border-white/80 bg-white/90",
  };
  const triageChipStyles = {
    emergency: "border-rose-300 bg-white text-rose-700",
    urgent: "border-amber-300 bg-white text-amber-700",
    routine: "border-teal/40 bg-white text-teal-700",
    insight: "border-white/80 bg-white text-ocean/70",
  };
  const triageCardClass = triageCardStyles[triageLevel] || "border-white/80 bg-white/90";
  const triageChipClass = triageChipStyles[triageLevel] || "border-white/80 bg-white text-ocean/70";
  const triageLabel = `${triageLevel.charAt(0).toUpperCase()}${triageLevel.slice(1)}`;
  const hasSymptomInsights = Boolean(symptomAnalysis);

  const renderSymptomAnalysisDetails = () => {
    if (!symptomAnalysis) {
      return (
        <p className="text-sm text-ocean/60">
          Insights appear here once the AI finishes reviewing the symptoms.
        </p>
      );
    }

    return (
      <div className="space-y-5">
        <div className={clsx("rounded-2xl border px-4 py-4 shadow-soft", triageCardClass)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Triage level</p>
              <p className="text-sm font-semibold text-ocean">{triageLabel}</p>
            </div>
            {symptomConditions.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {symptomConditions.map((item) => (
                  <span key={item} className={clsx("rounded-full border px-2 py-1", triageChipClass)}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
          {symptomAnalysis.triage?.summary && (
            <p className="mt-3 text-xs sm:text-sm text-ocean/70">{symptomAnalysis.triage.summary}</p>
          )}
          {symptomAnalysis.normalized_symptoms?.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Key symptom signals</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {symptomAnalysis.normalized_symptoms.map((item) => (
                  <span key={item} className="rounded-full border border-white/80 bg-white px-2 py-1 text-ocean/70">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(symptomAnalysis.severity_descriptors?.length ||
            symptomAnalysis.duration_descriptors?.length ||
            symptomAnalysis.systemic_symptoms?.length) > 0 && (
            <div className="mt-3 grid gap-3 text-xs text-ocean/70">
              {symptomAnalysis.severity_descriptors?.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Severity cues</p>
                  <p className="mt-1 leading-snug text-ocean/70">
                    {symptomAnalysis.severity_descriptors.join(", ")}
                  </p>
                </div>
              )}
              {symptomAnalysis.duration_descriptors?.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Timeline notes</p>
                  <p className="mt-1 leading-snug text-ocean/70">
                    {symptomAnalysis.duration_descriptors.join(", ")}
                  </p>
                </div>
              )}
              {symptomAnalysis.systemic_symptoms?.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Systemic findings</p>
                  <p className="mt-1 leading-snug text-ocean/70">
                    {symptomAnalysis.systemic_symptoms.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
          {symptomAnalysis.triage?.recommended_actions?.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Immediate guidance</p>
              <ul className="mt-2 space-y-1 text-xs text-ocean/70">
                {symptomAnalysis.triage.recommended_actions.map((action) => (
                  <li key={action} className="list-disc pl-4">
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {symptomAnalysis.triage?.red_flags?.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              <p className="font-semibold uppercase tracking-[0.15em] text-rose-500">Detected red flags</p>
              <p className="mt-1 text-rose-600">{symptomAnalysis.triage.red_flags.join(", ")}</p>
            </div>
          )}
        </div>

        {symptomAnalysis.conditions?.length > 0 && (
          <div className="space-y-4">
            {symptomAnalysis.conditions.map((condition) => {
              const confidencePercent = Math.round(condition.likelihood * 1000) / 10;
              const urgencyLabel =
                condition.urgency === "emergency"
                  ? "Emergency priority"
                  : condition.urgency === "urgent"
                  ? "Urgent review"
                  : "Routine follow-up";
              return (
                <div
                  key={condition.name}
                  className="rounded-2xl border border-white/80 bg-white/90 p-4 text-xs text-ocean/80 shadow-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-ocean">{condition.name}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">
                        Confidence: {condition.confidence} • {confidencePercent.toFixed(1)}%
                      </p>
                    </div>
                    <span className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                      {urgencyLabel}
                    </span>
                  </div>
                  {condition.summary && (
                    <p className="mt-3 leading-relaxed text-ocean/70">{condition.summary}</p>
                  )}
                  {condition.matched_symptoms?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Matched symptoms</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {condition.matched_symptoms.map((item) => (
                          <span key={item} className="rounded-full border border-white/80 bg-white px-2 py-1 text-ocean/70">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {condition.red_flags?.length > 0 && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-ocean">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">
                        Critical signs flagged
                      </p>
                      <p className="mt-1 text-xs">{condition.red_flags.join(", ")}</p>
                    </div>
                  )}
                  {condition.recommended_actions?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Recommended next steps</p>
                      <ul className="mt-2 space-y-1 text-xs leading-snug text-ocean/70">
                        {condition.recommended_actions.map((action) => (
                          <li key={action} className="list-disc pl-4">
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {condition.recommended_tests?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Suggested diagnostics</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {condition.recommended_tests.map((test) => (
                          <span key={test} className="rounded-full border border-white/80 bg-white px-2 py-1 text-ocean/70">
                            {test}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(symptomAnalysis.model_support?.length || 0) > 0 && (
          <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-xs text-ocean/70 shadow-soft">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Model signal</p>
            <ul className="mt-2 space-y-1">
              {symptomAnalysis.model_support.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4">
                  <span>{item.label}</span>
                  <span className="font-semibold text-ocean">
                    {Math.round(item.probability * 1000) / 10}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(symptomAnalysis.general_recommendations?.length || 0) > 0 && (
          <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-xs text-ocean/70 shadow-soft">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Follow-up suggestions</p>
            <ul className="mt-2 space-y-1 leading-snug">
              {symptomAnalysis.general_recommendations.map((note) => (
                <li key={note} className="list-disc pl-4">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

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
        <AiSummary
          summary={selectedReport.ai_summary}
          expanded={summaryExpanded}
          onExpansionChange={setSummaryExpanded}
        />
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
      <pre className="max-h-[320px] overflow-y-auto smooth-scroll-area rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm leading-relaxed text-ocean/70">
        {selectedReport.extracted_text || "Raw OCR output will be available here after processing."}
      </pre>
    );
  }, [detailTab, selectedReport, summaryExpanded]);

  return (
    <>
      <Head>
        <title>Dashboard | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <Navbar />
        <main className="section-stack">
            {notification && (
              <div className="section-card section-card--compact flex items-start justify-between gap-4 text-sm text-ocean/70">
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

            {authStatus === "ready" && user && plan === "individual" && (
              <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-6 text-sm text-amber-800 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Individual workspace</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-amber-700">Limited quota active</h2>
                    <p className="mt-1 text-amber-700/80">
                      You can upload up to 10 reports and 20 symptom checks per month. Upgrade to Clinician or
                      Institution for advanced analytics, team exports, and API access.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-teal/90"
                  >
                    Review plans
                  </Link>
                </div>
              </section>
            )}

            <section className="section-card">
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

            {!placeOverviewInSidebar && renderOverallHealth("main")}
            {renderAIDiagnosis()}
            {renderAIAdvice()}

            <section
              className={clsx(
                "grid gap-6",
                placeOverviewInSidebar ? "xl:grid-cols-[1.75fr,1.1fr]" : "xl:grid-cols-[1.6fr,1fr]"
              )}
            >
              <div className="space-y-6">
                <section className="section-card">
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
                  <div className="mt-4 flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      onClick={handleSecureDownload}
                      disabled={!selectedReport || plan === "individual"}
                      className={clsx(
                        "rounded-full border px-4 py-2 font-semibold uppercase tracking-[0.2em] transition",
                        !selectedReport || plan === "individual"
                          ? "border-sand/70 text-ocean/40"
                          : "border-teal/40 text-teal hover:bg-teal/10"
                      )}
                    >
                      Signed download
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      disabled={!selectedReport || plan === "individual"}
                      className={clsx(
                        "rounded-full border px-4 py-2 font-semibold uppercase tracking-[0.2em] transition",
                        !selectedReport || plan === "individual"
                          ? "border-sand/70 text-ocean/40"
                          : "border-ocean/20 text-ocean hover:bg-white/70"
                      )}
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="mt-6">{activeTabContent}</div>
                </section>

                <ChartSection data={timelineChartData} />
              </div>

              <aside className="space-y-6">
                <section className="section-card">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-ocean">Symptom checker</h3>
                      <p className="text-xs text-ocean/60">
                        Describe what the patient is feeling. AI suggests likely conditions to explore.
                      </p>
                    </div>
                    {(symptomAnalysis || symptomConditions.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSymptomAnalysis(null);
                          setSymptomConditions([]);
                          setSymptomStatus("");
                          setSymptoms("");
                          setSymptomModalOpen(false);
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
                  {symptomStatus && (
                    <p className="mt-3 text-xs text-ocean/60">{symptomStatus}</p>
                  )}
                  {symptomAnalysis || symptomConditions.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-white/80 bg-white/95 p-4 text-xs text-ocean/70 shadow-soft">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Latest triage</p>
                          <p className="text-base font-semibold text-ocean">
                            {symptomAnalysis ? triageLabel : "Analysis ready"}
                          </p>
                          {symptomAnalysis?.triage?.summary && (
                            <p className="mt-2 text-sm text-ocean/70">{symptomAnalysis.triage.summary}</p>
                          )}
                          {!symptomAnalysis?.triage?.summary && symptomStatus && (
                            <p className="mt-2 text-sm text-ocean/70">{symptomStatus}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => hasSymptomInsights && setSymptomModalOpen(true)}
                          className={clsx(
                            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                            hasSymptomInsights
                              ? "bg-teal text-white shadow hover:bg-teal/90"
                              : "cursor-not-allowed bg-sand/30 text-ocean/40"
                          )}
                          disabled={!hasSymptomInsights}
                        >
                          <SparklesIcon className="h-4 w-4" />
                          View full analysis
                        </button>
                      </div>
                      {symptomAnalysis?.normalized_symptoms?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Key signals</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {symptomAnalysis.normalized_symptoms.slice(0, 4).map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-white/80 bg-white px-2 py-1 text-ocean/70"
                              >
                                {item}
                              </span>
                            ))}
                            {symptomAnalysis.normalized_symptoms.length > 4 && (
                              <span className="rounded-full border border-white/60 bg-white px-2 py-1 text-ocean/50">
                                +{symptomAnalysis.normalized_symptoms.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {symptomConditions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Top matches</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {symptomConditions.slice(0, 3).map((item) => (
                              <span key={item} className={clsx("rounded-full border px-2 py-1", triageChipClass)}>
                                {item}
                              </span>
                            ))}
                            {symptomConditions.length > 3 && (
                              <span className="rounded-full border border-white/80 px-2 py-1 text-ocean/50">
                                +{symptomConditions.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-ocean/50">
                      Insights appear here once the AI finishes reviewing the symptoms.
                    </p>
                  )}
                </section>

                <section className="section-card">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ocean">Recent reports</h3>
                      <p className="text-xs text-ocean/60">
                        Select a report to review its narrative and insights.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteAllReports}
                        className="flex items-center gap-2 rounded-full border border-white/80 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={bulkDeleting || reports.length === 0}
                      >
                        {bulkDeleting ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                        {bulkDeleting ? "Deleting…" : "Delete all"}
                      </button>
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
                  </div>
                  <div className="space-y-3">
                    {reports.length > 0 ? (
                      reports.map((report) => {
                        const isActive = selectedReport?.id === report.id;
                        return (
                          <div
                            key={report.id}
                            role="button"
                            tabIndex={0}
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => handleReportSelect(report)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleReportSelect(report);
                              }
                            }}
                            className={clsx(
                              "w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-teal/40",
                              isActive
                                ? "border-teal/60 bg-teal/10 shadow-lg"
                                : "border-white/80 bg-white/90 hover:border-teal/40 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-ocean">{report.report_name}</p>
                                {isActive && (
                                  <span className="rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal">
                                    Active
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => handleDeleteReport(report, event)}
                                className="flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ocean/50 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={deletingReportId === report.id || bulkDeleting}
                                aria-label={`Delete ${report.report_name}`}
                              >
                                {deletingReportId === report.id ? (
                                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <TrashIcon className="h-3.5 w-3.5" />
                                )}
                                <span>Delete</span>
                              </button>
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
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-ocean/50">
                        Once you upload documents, their AI summaries and insights will appear here for quick access.
                      </p>
                    )}
                  </div>
                </section>

                {placeOverviewInSidebar && renderOverallHealth("sidebar")}
              </aside>
            </section>
          </main>
        </PageShell>
      {scoreModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ocean/80 px-4 py-10 backdrop-blur-sm"
          onClick={closeScoreModal}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto smooth-scroll-area rounded-3xl border border-white/60 bg-gradient-to-br from-white/95 via-white/98 to-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="score-explanation-title"
          >
            <button
              type="button"
              onClick={closeScoreModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/80 text-ocean/60 transition hover:text-ocean"
              aria-label="Close score breakdown"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <div className="pr-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ocean/40">
                Score breakdown
              </p>
              <h3 id="score-explanation-title" className="mt-2 text-2xl font-semibold text-ocean">
                Explain my score
              </h3>
              <p className="mt-2 text-sm text-ocean/60">
                We analysed {totalReportsCount.toLocaleString("en-US")} report
                {totalReportsCount === 1 ? "" : "s"} and {totalInsightsCount.toLocaleString("en-US")} individual
                finding{totalInsightsCount === 1 ? "" : "s"} to generate your {overallHealth.score}/100{" "}
                {overallHealth.grade.toLowerCase()} score.
              </p>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/80 bg-white/95 p-5 shadow-soft">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Current status</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-ocean">{overallHealth.score}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-ocean/40">/100</span>
                  </div>
                  <span
                    className={clsx(
                      "mt-3 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                      overallScoreBadgeClass
                    )}
                  >
                    {overallHealth.grade}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-ocean/70">{overallHealth.summary}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/95 p-5 text-xs text-ocean/70 shadow-soft">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">What was considered</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-ocean/40">Reports processed</p>
                      <p className="mt-1 text-base font-semibold text-ocean">
                        {totalReportsCount.toLocaleString("en-US")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-ocean/40">Insights scored</p>
                      <p className="mt-1 text-base font-semibold text-ocean">
                        {totalInsightsCount.toLocaleString("en-US")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-ocean/40">Categories tracked</p>
                      <p className="mt-1 text-base font-semibold text-ocean">
                        {overallHealth.categories.length.toLocaleString("en-US")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-ocean/40">Timeline points</p>
                      <p className="mt-1 text-base font-semibold text-ocean">
                        {overallHealth.timeline.length.toLocaleString("en-US")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/80 bg-white/95 p-5 text-xs text-ocean/70 shadow-soft">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Top factors influencing your score</p>
                  <div className="mt-3 space-y-3">
                    {topCategoryBreakdown.length > 0 ? (
                      topCategoryBreakdown.map((category) => (
                        <div
                          key={category.id}
                          className="rounded-xl border border-white/70 bg-white px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-ocean">{category.label}</p>
                            <span
                              className={clsx(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                                riskBadgeClass(category.level)
                              )}
                            >
                              {riskLevelLabel(category.level)}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-ocean/40">
                            Contribution {category.score}/100
                          </p>
                          <p className="mt-2 leading-snug text-ocean/70">
                            {category.descriptor || "Monitored routinely for changes."}
                          </p>
                          {category.worst?.text && (
                            <p className="mt-2 text-xs text-ocean/60">
                              Priority signal: {truncateText(category.worst.text, 160)}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-ocean/60">
                        We need additional reports before category-level drivers can be charted.
                      </p>
                    )}
                  </div>
                </div>
                {recentScoreSnapshots.length > 0 && (
                  <div className="rounded-2xl border border-white/80 bg-white/95 p-5 text-xs text-ocean/70 shadow-soft">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">Recent score trajectory</p>
                    <ul className="mt-3 space-y-3">
                      {recentScoreSnapshots.map((item) => (
                        <li key={item.reportId || item.reportName} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ocean/90">{item.reportName}</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-ocean/40">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-ocean">{item.score}</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-ocean/40">/100</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {overallHealth.flaggedInsights.length > 0 && (
              <div className="mt-6 rounded-2xl border border-white/80 bg-white/95 p-5 text-xs text-ocean/70 shadow-soft">
                <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/60">
                  Highest impact findings
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {overallHealth.flaggedInsights.map((insight) => (
                    <div key={`${insight.reportId}-${insight.text}`} className="rounded-xl border border-white/70 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ocean">{insight.category.label}</p>
                        <span
                          className={clsx(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                            riskBadgeClass(insight.level)
                          )}
                        >
                          {riskLevelLabel(insight.level)}
                        </span>
                      </div>
                      <p className="mt-2 leading-snug text-ocean/70">{truncateText(insight.text, 160)}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-ocean/40">
                        {insight.reportName} • {formatDateTime(insight.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {selectedInsight && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ocean/80 px-4 py-10 backdrop-blur-sm"
          onClick={handleInsightModalClose}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto smooth-scroll-area rounded-3xl border border-white/60 bg-gradient-to-br from-white/95 via-white/98 to-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flagged-insight-title"
          >
            <button
              type="button"
              onClick={handleInsightModalClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/80 text-ocean/60 transition hover:text-ocean"
              aria-label="Close key finding details"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <div className="pr-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ocean/40">
                Key finding detail
              </p>
              <h3 id="flagged-insight-title" className="mt-2 text-2xl font-semibold text-ocean">
                {selectedInsight.label}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-ocean/50">
                <span className="rounded-full border border-white/80 px-3 py-1">
                  {selectedInsight.category?.label ?? "General"}
                </span>
                <span
                  className={clsx(
                    "rounded-full border px-3 py-1 font-semibold",
                    riskBadgeClass(selectedInsight.level)
                  )}
                >
                  {riskLevelLabel(selectedInsight.level)}
                </span>
                {selectedInsight.isSummary && (
                  <span className="rounded-full border border-white/60 px-3 py-1">
                    From AI summary
                  </span>
                )}
              </div>
            </div>
            <div
              className={clsx(
                "mt-6 rounded-2xl border px-4 py-4 text-sm leading-relaxed",
                riskCardClass(selectedInsight.level)
              )}
            >
              <p className={clsx("text-base font-semibold", riskCardHeadingClass(selectedInsight.level))}>
                Full context
              </p>
              <p className={clsx("mt-2", riskCardBodyClass(selectedInsight.level))}>
                {selectedInsight.text}
              </p>
            </div>
            <div className="mt-5 grid gap-4 text-xs text-ocean/70 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Descriptor</p>
                <p className="mt-1 leading-snug text-ocean/80">
                  {selectedInsight.descriptor || "Review recommended."}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/50">Source report</p>
                <p className="mt-1 leading-snug text-ocean/80">
                  {selectedInsight.reportName || "Unknown report"}
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-ocean/40">
                  {formatDateTime(selectedInsight.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {symptomModalOpen && hasSymptomInsights && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ocean/80 px-4 py-10 backdrop-blur-sm"
          onClick={() => setSymptomModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto smooth-scroll-area rounded-3xl border border-white/60 bg-gradient-to-br from-white/95 via-white/98 to-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="symptom-analysis-title"
          >
            <button
              type="button"
              onClick={() => setSymptomModalOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/80 text-ocean/60 transition hover:text-ocean"
              aria-label="Close symptom analysis"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <div className="pr-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ocean/40">
                Symptom checker
              </p>
              <h3 id="symptom-analysis-title" className="mt-2 text-2xl font-semibold text-ocean">
                AI symptom analysis
              </h3>
              {symptomStatus && (
                <p className="mt-2 text-sm text-ocean/60">{symptomStatus}</p>
              )}
            </div>
            <div className="mt-6">{renderSymptomAnalysisDetails()}</div>
          </div>
        </div>
      )}
    </>
  );
}
