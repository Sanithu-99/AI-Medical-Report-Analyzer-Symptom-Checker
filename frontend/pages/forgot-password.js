import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowPathIcon, EnvelopeOpenIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import PageShell from "@/components/PageShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setMessage("Enter the email you use for Med Analyzr AI.");
      return;
    }

    setLoading(true);
    setMessage("");
    setResetToken("");
    try {
      const response = await api.post("/api/auth/password/forgot", { email: email.trim() });
      setMessage(response.data?.detail ?? "If the account exists, we'll email instructions shortly.");
      if (response.data?.reset_token) {
        setResetToken(response.data.reset_token);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || "We couldn't initiate the reset just now.";
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <div className="mx-auto max-w-xl space-y-10">
          <header className="text-center space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-teal">
              <EnvelopeOpenIcon className="h-4 w-4" />
              Reset access
            </span>
            <h1 className="text-3xl font-semibold text-ocean">Forgot your password?</h1>
            <p className="text-sm text-ocean/70">
              Enter your email address and we'll send a secure link. For testing environments, a manual token will appear below.
            </p>
          </header>

          <main className="section-card space-y-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm text-ocean">
                Work email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Email reset link
              </button>
            </form>

            {message && <p className="text-sm text-teal">{message}</p>}

            {resetToken && (
              <div className="section-card section-card--compact text-xs text-ocean/70">
                <p className="font-semibold text-ocean">Manual reset token</p>
                <p className="mt-1 text-ocean/60">
                  Paste this on the{" "}
                  <button
                    type="button"
                    onClick={() => router.push(`/reset-password?token=${encodeURIComponent(resetToken)}`)}
                    className="text-teal underline-offset-2 hover:underline"
                  >
                    reset page
                  </button>{" "}
                  if you're testing without email.
                </p>
                <code className="mt-3 block break-words rounded-xl bg-sand/30 px-3 py-2 font-mono text-[13px] text-ocean">
                  {resetToken}
                </code>
              </div>
            )}

            <p className="text-center text-sm text-ocean/60">
              Remembered your password?{" "}
              <Link href="/login" className="font-semibold text-teal transition hover:text-teal/80">
                Back to login
              </Link>
            </p>
          </main>
        </div>
      </PageShell>
    </>
  );
}
