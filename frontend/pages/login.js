import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import api, { setAuthToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        const response = await api.post(
          "/api/auth/login",
          new URLSearchParams({ username: email, password })
        );
        const token = response.data.access_token;
        setAuthToken(token);
        setMessage("Logged in successfully.");
        router.push("/dashboard");
      }
    } catch (error) {
      const detail = error.response?.data?.detail || "Something went wrong.";
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{mode === "login" ? "Login" : "Register"} | AI Medical Analyzer</title>
      </Head>
      <div className="min-h-screen bg-soft-gray px-4 sm:px-8 py-12">
        <div className="max-w-5xl mx-auto space-y-12">
          <Navbar />
          <main className="glass gradient-border p-6 sm:p-10 lg:p-14">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <section className="space-y-6">
                <p className="inline-flex items-center gap-2 rounded-full bg-soft-gray/80 px-4 py-2 text-xs font-medium text-gray-500">
                  Secure AI workspace
                </p>
                <div className="space-y-4">
                  <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h1>
                  <p className="text-base text-gray-500">
                    {mode === "login"
                      ? "Sign in to manage report uploads, AI summaries, and symptom insights in one intuitive dashboard."
                      : "Set up your secure workspace and unlock instant OCR, clinical interpretation, and personalised symptom guidance."}
                  </p>
                </div>
                <ul className="space-y-3 text-sm text-gray-500">
                  <li>• Bank-grade encryption for your clinical documents</li>
                  <li>• AI-driven summaries with explainable health indicators</li>
                  <li>• Symptom checker informed by clinical best practices</li>
                </ul>
              </section>
              <div className="space-y-5 rounded-3xl border border-white/60 bg-white/80 p-6 sm:p-8 shadow-soft backdrop-blur-xl">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <label className="block text-sm text-gray-600">
                    Email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-silver bg-white px-4 py-3 text-sm focus:border-midnight focus:outline-none"
                    />
                  </label>
                  <label className="block text-sm text-gray-600">
                    Password
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-silver bg-white px-4 py-3 text-sm focus:border-midnight focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-midnight text-white py-3 font-medium shadow-lg shadow-midnight/20 hover:shadow-midnight/40 disabled:opacity-70"
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
                  </button>
                </form>
                {message && <p className="text-center text-sm text-gray-500">{message}</p>}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="w-full text-sm text-gray-500 hover:text-midnight"
                >
                  {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
