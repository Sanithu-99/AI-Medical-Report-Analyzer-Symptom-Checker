import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import UploadBox from "@/components/UploadBox";
import ResultCard from "@/components/ResultCard";
import ChartSection from "@/components/ChartSection";
import api from "@/lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [symptomInsights, setSymptomInsights] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadReports = async () => {
      try {
        const response = await api.get("/api/reports");
        const items = response.data || [];
        setReports(items);
        setSelectedReport(items[0] || null);
      } catch (error) {
        console.warn("Failed to fetch reports", error);
      }
    };

    loadReports();
  }, [router]);

  const handleUpload = async (file) => {
    setUploading(true);
    setStatusMessage("");
    try {
      const formData = new FormData();
      formData.append("report_file", file);
      const response = await api.post("/api/reports/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newReport = response.data;
      setReports((prev) => [newReport, ...prev]);
      setSelectedReport(newReport);
      setStatusMessage("Report analysed successfully.");
    } catch (error) {
      const detail = error.response?.data?.detail || "Upload failed. Please try again.";
      setStatusMessage(detail);
    } finally {
      setUploading(false);
    }
  };

  const handleSymptomCheck = async (event) => {
    event.preventDefault();
    if (!symptoms.trim()) return;
    setStatusMessage("");
    try {
      const response = await api.post("/api/symptoms", { symptoms });
      setSymptomInsights(response.data.possible_conditions || []);
      setStatusMessage("Symptom analysis ready.");
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to analyse symptoms.";
      setStatusMessage(detail);
    }
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

  return (
    <>
      <Head>
        <title>Dashboard | AI Medical Analyzer</title>
      </Head>
      <div className="min-h-screen bg-soft-gray px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-10">
          <Navbar />
          <main className="space-y-10">
            <section className="grid lg:grid-cols-5 gap-6 items-start">
              <div className="lg:col-span-3 space-y-6">
                <UploadBox onUpload={handleUpload} uploading={uploading} />
                {statusMessage && (
                  <p className="text-sm text-gray-500 text-center lg:text-left">{statusMessage}</p>
                )}
                <ResultCard
                  title="AI Summary"
                  content={selectedReport?.ai_summary}
                  footer={selectedReport ? `Generated ${new Date(selectedReport.created_at).toLocaleString()}` : undefined}
                />
              </div>
              <div className="lg:col-span-2 space-y-6">
                <ChartSection data={chartData} />
                <section className="glass gradient-border p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Symptom Checker</h3>
                  <form className="space-y-4" onSubmit={handleSymptomCheck}>
                    <textarea
                      value={symptoms}
                      onChange={(event) => setSymptoms(event.target.value)}
                      placeholder="e.g., persistent fatigue, dizziness, shortness of breath"
                      className="w-full min-h-[120px] rounded-2xl border border-silver bg-white/80 px-4 py-3 text-sm focus:border-midnight focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-full bg-midnight text-white py-3 text-sm font-medium shadow-lg shadow-midnight/20 hover:shadow-midnight/40"
                    >
                      Analyse Symptoms
                    </button>
                  </form>
                  <div className="space-y-2 text-sm text-gray-600">
                    {symptomInsights.length > 0 ? (
                      symptomInsights.map((item) => <p key={item}>{item}</p>)
                    ) : (
                      <p className="text-gray-500">Enter symptoms to receive AI-assisted suggestions.</p>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Recent Reports</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="glass gradient-border p-6 text-left space-y-3 transition hover:-translate-y-1"
                  >
                    <p className="text-sm font-semibold">{report.report_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-3">{report.ai_summary}</p>
                  </button>
                ))}
                {reports.length === 0 && (
                  <p className="text-sm text-gray-500">No reports yet. Upload your first medical report to begin.</p>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
