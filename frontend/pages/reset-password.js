import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowPathIcon, KeyIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import PageShell from "@/components/PageShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (router.isReady && typeof router.query.token === "string") {
      setToken(router.query.token);
    }
  }, [router.isReady, router.query.token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token.trim()) {
      setMessage("Paste the reset token you received.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await api.post("/api/auth/password/reset", {
        token: token.trim(),
        new_password: password,
      });
      setMessage("Password reset successfully. Redirecting to login…");
      setTimeout(() => {
        router.push("/login");
      }, 1800);
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to reset password with that token.";
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <div className="mx-auto max-w-xl space-y-10">
          <header className="text-center space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-teal">
              <KeyIcon className="h-4 w-4" />
              Final step
            </span>
            <h1 className="text-3xl font-semibold text-ocean">Set a new password</h1>
            <p className="text-sm text-ocean/70">
              Paste the reset token you received via email or from your administrator, then choose a new password.
            </p>
          </header>

          <main className="section-card space-y-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm text-ocean">
                Reset token
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                />
              </label>
              <label className="block text-sm text-ocean">
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                />
              </label>
              <label className="block text-sm text-ocean">
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Reset password
              </button>
            </form>

            {message && <p className="text-sm text-teal">{message}</p>}

            <p className="text-center text-sm text-ocean/60">
              Remembered your credentials?{" "}
              <Link href="/login" className="font-semibold text-teal transition hover:text-teal/80">
                Return to login
              </Link>
            </p>
          </main>
        </div>
      </PageShell>
    </>
  );
}
