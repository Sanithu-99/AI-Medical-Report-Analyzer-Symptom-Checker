import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import clsx from "clsx";
import {
  ArrowPathIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  KeyIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageShell from "@/components/PageShell";

const initialPasswordForm = { current: "", next: "", confirm: "", mfa: "" };

export default function SettingsPage() {
  const router = useRouter();
  const { user, status, refresh, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [latestResetToken, setLatestResetToken] = useState("");

  const [tokenReset, setTokenReset] = useState({ token: "", password: "", confirm: "" });
  const [tokenResetMessage, setTokenResetMessage] = useState("");
  const [tokenResetLoading, setTokenResetLoading] = useState(false);

  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    if (status === "ready" && !user) {
      router.replace("/login");
    }
  }, [status, user, router]);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      setRecoveryEmail(user.email);
    }
  }, [user?.email]);

  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setProfileMessage("Email cannot be empty.");
      return;
    }
    setProfileLoading(true);
    setProfileMessage("");
    try {
      await api.put("/api/auth/profile", { email: email.trim() });
      await refresh();
      setProfileMessage("Email updated successfully.");
    } catch (error) {
      const detail = error.response?.data?.detail || "We could not update your email right now.";
      setProfileMessage(detail);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    if (!passwordForm.current || !passwordForm.next) {
      setPasswordMessage("Please provide your current and new passwords.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage("");
    try {
      await api.post("/api/auth/password/change", {
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        mfa_code: passwordForm.mfa || undefined,
      });
      setPasswordMessage("Password updated. Use the new password next time you sign in.");
      setPasswordForm(initialPasswordForm);
    } catch (error) {
      const detail = error.response?.data?.detail || "Password change failed.";
      setPasswordMessage(detail);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    if (!recoveryEmail.trim()) {
      setRecoveryMessage("Please enter an email address.");
      return;
    }
    setRecoveryLoading(true);
    setRecoveryMessage("");
    setLatestResetToken("");
    try {
      const response = await api.post("/api/auth/password/forgot", {
        email: recoveryEmail.trim(),
      });
      setRecoveryMessage(response.data?.detail ?? "If the account exists, you'll receive reset instructions.");
      if (response.data?.reset_token) {
        setLatestResetToken(response.data.reset_token);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to initiate password reset.";
      setRecoveryMessage(detail);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetWithToken = async (event) => {
    event.preventDefault();
    if (!tokenReset.token || !tokenReset.password) {
      setTokenResetMessage("Provide the reset token and a new password.");
      return;
    }
    if (tokenReset.password !== tokenReset.confirm) {
      setTokenResetMessage("Passwords do not match.");
      return;
    }

    setTokenResetLoading(true);
    setTokenResetMessage("");
    try {
      await api.post("/api/auth/password/reset", {
        token: tokenReset.token,
        new_password: tokenReset.password,
      });
      setTokenResetMessage("Password reset successfully. You can now log in with the new password.");
      setTokenReset({ token: "", password: "", confirm: "" });
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to reset password with that token.";
      setTokenResetMessage(detail);
    } finally {
      setTokenResetLoading(false);
    }
  };

  const beginMfaSetup = async () => {
    setMfaLoading(true);
    setMfaMessage("");
    try {
      const response = await api.post("/api/auth/mfa/setup");
      setMfaSetup(response.data);
      setMfaMessage("Scan the QR code or enter the key below, then confirm with a 6-digit code.");
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to start MFA setup.";
      setMfaMessage(detail);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaEnable = async (event) => {
    event.preventDefault();
    if (!mfaCode) {
      setMfaMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setMfaLoading(true);
    setMfaMessage("");
    try {
      await api.post("/api/auth/mfa/enable", { code: mfaCode });
      await refresh();
      setMfaCode("");
      setMfaMessage("MFA enabled successfully.");
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to verify the code.";
      setMfaMessage(detail);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async (event) => {
    event.preventDefault();
    if (!mfaCode) {
      setMfaMessage("Provide your current MFA code to disable protection.");
      return;
    }
    setMfaLoading(true);
    setMfaMessage("");
    try {
      await api.post("/api/auth/mfa/disable", { code: mfaCode });
      await refresh();
      setMfaCode("");
      setMfaSetup(null);
      setMfaMessage("MFA disabled. Re-enable it to keep PHI protected.");
    } catch (error) {
      const detail = error.response?.data?.detail || "Unable to disable MFA.";
      setMfaMessage(detail);
    } finally {
      setMfaLoading(false);
    }
  };

  const isReady = status === "ready" && Boolean(user);

  const securityTips = useMemo(
    () => [
      "Rotate credentials regularly and avoid reusing passwords across systems.",
      "Share reset tokens only through secure, trusted channels.",
      "Enable SSO once your organisation connects its identity provider.",
    ],
    []
  );

  if (!isReady) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Settings | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <Navbar />
        <main className="section-stack">
            <header className="section-card rounded-3xl p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-teal/40 bg-white/95 text-2xl text-teal">
                    <Cog6ToothIcon className="h-8 w-8" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.28em] text-ocean/60">Workspace settings</p>
                    <h1 className="text-3xl font-semibold text-ocean">Manage your account</h1>
                    <p className="text-sm text-ocean/60">Control credentials, recovery options, and workspace access.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                  Sign out everywhere
                </button>
              </div>
            </header>

            <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
              <div className="space-y-6">
                <article className="section-card space-y-5 p-6">
                  <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                    <EnvelopeIcon className="h-4 w-4 text-teal" />
                    Contact email
                  </header>
                  <p className="text-sm text-ocean/70">
                    Update the credential used for login and critical alerts. We recommend using a monitored inbox.
                  </p>
                  <form className="space-y-4" onSubmit={handleProfileUpdate}>
                    <label className="block text-sm text-ocean">
                      Email address
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={profileLoading}
                    >
                      {profileLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                      Save email
                    </button>
                  </form>
                  {profileMessage && (
                    <p className="text-sm text-teal">{profileMessage}</p>
                  )}
                </article>

                <article className="section-card space-y-5 p-6">
                  <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                    <KeyIcon className="h-4 w-4 text-teal" />
                    Update password
                  </header>
                  <p className="text-sm text-ocean/70">
                    Choose a strong phrase with at least 12 characters. This change applies to all of your active sessions.
                  </p>
                  <form className="space-y-4" onSubmit={handlePasswordUpdate}>
                    <label className="block text-sm text-ocean">
                      Current password
                      <input
                        type="password"
                        value={passwordForm.current}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, current: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm text-ocean">
                        New password
                        <input
                          type="password"
                          value={passwordForm.next}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({ ...prev, next: event.target.value }))
                          }
                          className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                        />
                      </label>
                      <label className="block text-sm text-ocean">
                        Confirm password
                        <input
                          type="password"
                          value={passwordForm.confirm}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))
                          }
                          className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                        />
                      </label>
                    </div>
                    <label className="block text-sm text-ocean">
                      MFA code (if enabled)
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={passwordForm.mfa}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, mfa: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                        placeholder="123456"
                      />
                      <span className="mt-1 block text-xs text-ocean/50">
                        Required when multi-factor authentication is enabled.
                      </span>
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={passwordLoading}
                    >
                      {passwordLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                      Change password
                    </button>
                  </form>
                  {passwordMessage && <p className="text-sm text-teal">{passwordMessage}</p>}
                </article>
              </div>

              <aside className="space-y-6">
                <article className="section-card space-y-5 p-6">
                  <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                    <LifebuoyIcon className="h-4 w-4 text-teal" />
                    Recovery options
                  </header>
                  <p className="text-sm text-ocean/70">
                    Generate a password reset token and keep it secure. Tokens expire after one hour or immediately after use.
                  </p>
                  <form className="space-y-4" onSubmit={handleForgotPassword}>
                    <label className="block text-sm text-ocean">
                      Send reset to
                      <input
                        type="email"
                        value={recoveryEmail}
                        onChange={(event) => setRecoveryEmail(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-5 py-2 text-sm font-semibold text-teal transition hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={recoveryLoading}
                    >
                      {recoveryLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                      Email reset link
                    </button>
                  </form>
                  {recoveryMessage && <p className="text-sm text-teal">{recoveryMessage}</p>}
                  {latestResetToken && (
                    <div className="rounded-2xl border border-white/80 bg-white/95 p-4 text-xs text-ocean/70 shadow-soft">
                      <p className="font-semibold text-ocean">Manual reset token</p>
                      <p className="mt-1 text-ocean/60">
                        For testing environments only. Share this token securely with the account owner.
                      </p>
                      <code className="mt-3 block break-words rounded-xl bg-sand/30 px-3 py-2 font-mono text-[13px] text-ocean">
                        {latestResetToken}
                      </code>
                    </div>
                  )}
                </article>
                <article className="section-card space-y-5 p-6">
                  <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                    <ShieldCheckIcon className="h-4 w-4 text-teal" />
                    Multi-factor authentication
                  </header>
                  <p className="text-sm text-ocean/70">
                    Pair Med Analyzr AI with a TOTP authenticator (1Password, Microsoft, Google) to block unauthorised access.
                  </p>
                  <div className="space-y-3 rounded-2xl border border-white/80 bg-white/95 p-4 text-sm text-ocean/70 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">Status</p>
                    <p className="text-base font-semibold text-ocean">
                      {user?.mfa_enabled ? "Enabled" : "Disabled"}
                    </p>
                    <button
                      type="button"
                      onClick={beginMfaSetup}
                      className="inline-flex items-center justify-center rounded-full border border-teal/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal transition hover:bg-teal/10 disabled:opacity-60"
                      disabled={mfaLoading}
                    >
                      {user?.mfa_enabled ? "Regenerate secret" : "Start setup"}
                    </button>
                    {mfaSetup && (
                      <div className="space-y-2 text-xs text-ocean/80">
                        <p>
                          Secret: <span className="font-mono text-sm">{mfaSetup.secret}</span>
                        </p>
                        <p className="break-words">
                          Provisioning URI: <span className="font-mono">{mfaSetup.provisioning_uri}</span>
                        </p>
                      </div>
                    )}
                    <form className="space-y-3" onSubmit={user?.mfa_enabled ? handleMfaDisable : handleMfaEnable}>
                      <label className="block text-sm text-ocean">
                        Authenticator code
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
                      <button
                        type="submit"
                        className={clsx(
                          "inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                          user?.mfa_enabled ? "border border-rose-200 text-rose-600" : "bg-teal text-white"
                        )}
                        disabled={mfaLoading}
                      >
                        {mfaLoading ? "Saving…" : user?.mfa_enabled ? "Disable MFA" : "Enable MFA"}
                      </button>
                    </form>
                    {mfaMessage && <p className="text-xs text-teal">{mfaMessage}</p>}
                  </div>
                </article>

                <article className="section-card space-y-5 p-6">
                  <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                    <SparklesIcon className="h-4 w-4 text-teal" />
                    Redeem reset token
                  </header>
                  <p className="text-sm text-ocean/70">
                    Paste a valid reset token to choose a new password immediately.
                  </p>
                  <form className="space-y-4" onSubmit={handleResetWithToken}>
                    <label className="block text-sm text-ocean">
                      Reset token
                      <input
                        value={tokenReset.token}
                        onChange={(event) =>
                          setTokenReset((prev) => ({ ...prev, token: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm text-ocean">
                        New password
                        <input
                          type="password"
                          value={tokenReset.password}
                          onChange={(event) =>
                            setTokenReset((prev) => ({ ...prev, password: event.target.value }))
                          }
                          className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                        />
                      </label>
                      <label className="block text-sm text-ocean">
                        Confirm password
                        <input
                          type="password"
                          value={tokenReset.confirm}
                          onChange={(event) =>
                            setTokenReset((prev) => ({ ...prev, confirm: event.target.value }))
                          }
                          className="mt-2 w-full rounded-2xl border border-sand/70 bg-white px-4 py-3 text-sm text-ocean placeholder-ocean/40 focus:border-teal focus:outline-none"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-white px-5 py-2 text-sm font-semibold text-teal transition hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={tokenResetLoading}
                    >
                      {tokenResetLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                      Reset password
                    </button>
                  </form>
                  {tokenResetMessage && <p className="text-sm text-teal">{tokenResetMessage}</p>}
                </article>

                <article className="section-card space-y-4 p-6">
                  <header className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                    <ShieldCheckIcon className="h-4 w-4 text-teal" />
                    Workspace hygiene
                  </header>
                  <ul className="space-y-2 text-sm text-ocean/70">
                    {securityTips.map((tip) => (
                      <li key={tip} className="flex gap-2">
                        <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-teal/70" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </aside>
            </section>
          </main>
        </PageShell>
    </>
  );
}
