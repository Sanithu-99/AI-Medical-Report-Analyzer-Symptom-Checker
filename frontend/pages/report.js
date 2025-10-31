import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import ResultCard from "@/components/ResultCard";
import api from "@/lib/api";

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

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
        console.warn("Failed to load reports", error);
      }
    };

    loadReports();
  }, [router]);

  return (
    <>
      <Head>
        <title>Reports | AI Medical Analyzer</title>
      </Head>
      <div className="min-h-screen bg-soft-gray px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-10">
          <Navbar />
          <main className="grid lg:grid-cols-5 gap-6 items-start">
            <section className="lg:col-span-3 space-y-6">
              <ResultCard
                title="AI Summary"
                content={selectedReport?.ai_summary}
                footer={selectedReport ? `Generated ${new Date(selectedReport.created_at).toLocaleString()}` : undefined}
              />
              <section className="glass gradient-border p-6 space-y-4">
                <h3 className="text-lg font-semibold">Extracted Text</h3>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {selectedReport?.extracted_text || "Select a report to view raw OCR output."}
                </pre>
              </section>
            </section>
            <aside className="lg:col-span-2 space-y-6">
              <section className="glass gradient-border p-6 space-y-4">
                <h3 className="text-lg font-semibold">Insights</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  {selectedReport?.insights?.length ? (
                    selectedReport.insights.map((item) => <li key={item}>• {item}</li>)
                  ) : (
                    <li className="text-gray-500">Insights will appear after uploading reports.</li>
                  )}
                </ul>
              </section>
              <section className="glass gradient-border p-6 space-y-4">
                <h3 className="text-lg font-semibold">All Reports</h3>
                <div className="space-y-2">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className="w-full rounded-2xl border border-transparent bg-white/70 px-4 py-3 text-left text-sm text-gray-600 hover:border-midnight"
                    >
                      <p className="font-medium text-midnight">{report.report_name}</p>
                      <p className="text-xs text-gray-500">{new Date(report.created_at).toLocaleString()}</p>
                    </button>
                  ))}
                  {reports.length === 0 && (
                    <p className="text-sm text-gray-500">No reports available yet.</p>
                  )}
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>
    </>
  );
}
