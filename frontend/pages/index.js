import Head from "next/head";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Head>
        <title>AI Medical Analyzer</title>
      </Head>
      <div className="min-h-screen bg-soft-gray px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-11">
          <Navbar />
          <main className="grid md:grid-cols-2 gap-10 items-center">
            <section className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                Understand medical reports in seconds with AI precision.
              </h1>
              <p className="text-gray-600 text-lg">
                Upload lab results, radiology scans, or discharge summaries. Our AI extracts, interprets,
                and visualises the essentials so you and your care team stay in sync.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard"
                  className="rounded-full px-6 py-3 bg-midnight text-white text-sm font-medium shadow-lg shadow-midnight/20 hover:shadow-midnight/40"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/report"
                  className="rounded-full px-6 py-3 bg-white text-midnight text-sm font-medium border border-silver hover:border-midnight"
                >
                  Browse Reports
                </Link>
              </div>
            </section>
            <section className="glass gradient-border p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-soft-gray/50 rounded-2xl p-4">
                  <p className="text-gray-500">OCR Accuracy</p>
                  <p className="text-2xl font-semibold">99%</p>
                </div>
                <div className="bg-soft-gray/50 rounded-2xl p-4">
                  <p className="text-gray-500">Insights Generated</p>
                  <p className="text-2xl font-semibold">3x faster</p>
                </div>
                <div className="bg-soft-gray/50 rounded-2xl p-4">
                  <p className="text-gray-500">Symptom Matches</p>
                  <p className="text-2xl font-semibold">+20</p>
                </div>
                <div className="bg-soft-gray/50 rounded-2xl p-4">
                  <p className="text-gray-500">User Satisfaction</p>
                  <p className="text-2xl font-semibold">4.9/5</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Securely hosted with encryption in transit and rest, powered by FastAPI and MongoDB Atlas.
              </p>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
