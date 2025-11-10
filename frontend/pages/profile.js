import { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRightOnRectangleIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import PageShell from "@/components/PageShell";

export default function ProfilePage() {
  const router = useRouter();
  const { user, status, logout } = useAuth();

  useEffect(() => {
    if (status === "ready" && !user) {
      router.replace("/login");
    }
  }, [status, user, router]);

  if (status !== "ready" && !user) {
    return null;
  }

  const joinedAt = user?.created_at ? new Date(user.created_at).toLocaleString() : "—";

  const handleLogout = async () => {
    logout();
    await router.push("/");
  };

  return (
    <>
      <Head>
        <title>Profile | Med Analyzr AI</title>
      </Head>
      <PageShell>
        <Navbar />
        <main className="section-stack">
          <header className="section-card">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-teal/40 bg-white/90 text-2xl font-semibold text-teal">
                    {user?.email?.[0]?.toUpperCase() || <UserIcon className="h-8 w-8" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm uppercase tracking-[0.3em] text-ocean/60">Account</p>
                    <h1 className="text-3xl font-semibold text-ocean">{user?.email}</h1>
                    <p className="text-sm text-ocean/60">Joined {joinedAt}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="rounded-full border border-white/80 px-5 py-2 text-sm font-semibold text-ocean transition hover:border-teal hover:text-teal"
                  >
                    Open dashboard
                  </Link>
                  <Link
                    href="/settings"
                    className="rounded-full border border-teal/40 bg-teal/10 px-5 py-2 text-sm font-semibold text-teal transition hover:bg-teal/20"
                  >
                    Account settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <article className="section-card space-y-4">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                  <ShieldCheckIcon className="h-4 w-4 text-teal" />
                  Security posture
                </div>
                <p className="text-sm text-ocean/70">
                  Sessions are guarded by short-lived access tokens. Rotate login credentials regularly and enable SSO once connected to your identity provider.
                </p>
                <ul className="space-y-2 text-sm text-ocean/60">
                  <li>• Encrypted at rest and in transit</li>
                  <li>• Audit trail generated for every report processed</li>
                  <li>• Role-based permissions aligned to clinical teams</li>
                </ul>
            </article>

            <article className="section-card space-y-4">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-ocean/50">
                  <LockClosedIcon className="h-4 w-4 text-teal" />
                  Session details
                </div>
                <p className="text-sm text-ocean/70">
                  You are currently authenticated with a bearer token stored securely in your browser. Log out across shared devices to prevent unauthorised access.
                </p>
                <div className="rounded-2xl border border-white/80 bg-white/90 p-4 text-xs text-ocean/60">
                  Looking to invite teammates? Share the registration link and manage access from the admin workspace (coming soon).
                </div>
            </article>
          </section>
        </main>
      </PageShell>
    </>
  );
}
