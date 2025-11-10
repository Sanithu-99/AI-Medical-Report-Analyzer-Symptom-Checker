import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import api, { ensureDeviceFingerprint } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageShell from "@/components/PageShell";

export default function LoginPage() {
  const router = useRouter();
  const { login: completeLogin } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        await api.post("/api/auth/register", { email, password });
        setMessage("Account created. Please log in.");
        setMode("login");
      } else {
        const response = await api.post("/api/auth/login", {
          email,
          password,
          mfa_code: mfaCode || undefined,
          device_fingerprint: ensureDeviceFingerprint(),
        });
        await completeLogin(response.data);
        setMessage("Logged in successfully.");
        if (!response.data.plan || response.data.plan === "individual") {
          router.push("/pricing");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (error) {
      const detail = error.response?.data?.detail || "Something went wrong.";
      setMessage(detail);
      if (detail.toLowerCase().includes("mfa")) {
        setMfaCode("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{mode === "login" ? "Login" : "Register"} | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <main className="section-card">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <section className="space-y-6">
                <p className="inline-flex w-max items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-teal">
                  Secure AI workspace
                </p>
                <div className="space-y-4">
                  <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-ocean">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h1>
                  <p className="text-base text-ocean/70">
                    {mode === "login"
                      ? "Sign in to manage report uploads, AI summaries, and symptom insights in one intuitive dashboard."
                      : "Set up your secure workspace and unlock instant OCR, clinical interpretation, and personalised symptom guidance."}
                  </p>
                </div>
                <ul className="space-y-3 text-sm text-ocean/70">
                  <li>• Bank-grade encryption for your clinical documents</li>
                  <li>• AI-driven summaries with explainable health indicators</li>
                  <li>• Symptom checker informed by clinical best practices</li>
                </ul>
              </section>
              <div className="section-card section-card--compact space-y-5">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <label className="block text-sm text-ocean">
                    Email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                    />
                  </label>
                  <label className="block text-sm text-ocean">
                    Password
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                    />
                  </label>
                  {mode === "login" && (
                    <label className="block text-sm text-ocean">
                      MFA code (if enabled)
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                        placeholder="123456"
                      />
                    </label>
                  )}
                  {mode === "login" && (
                    <div className="flex items-center justify-between text-xs text-ocean/60">
                      <span>Forgot your password?</span>
                      <Link
                        href="/forgot-password"
                        className="font-semibold text-teal transition hover:text-teal/80"
                      >
                        Reset it here
                      </Link>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-full bg-teal py-3 font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
                  </button>
                </form>
                {message && <p className="text-center text-sm text-teal">{message}</p>}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="w-full text-sm text-ocean/60 transition hover:text-teal"
                >
                  {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
                </button>
              </div>
              <div className="section-card section-card--compact text-sm text-ocean/80">
                <p className="font-semibold text-ocean">HIPAA-ready onboarding</p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed">
                  <li>• All uploaded reports are anonymised on-device before leaving your browser.</li>
                  <li>• VPN/proxy logins are blocked to protect PHI. Disable VPN if prompted.</li>
                  <li>• Choose a plan after signing in to unlock clinician or institutional controls.</li>
                </ul>
              </div>
            </div>
        </main>
      </PageShell>
    </>
  );
}
