import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/context/AuthContext";

function UserAvatar({ email }) {
  if (!email) {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sand text-ocean/70">
        ?
      </span>
    );
  }

  const initial = email.charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal text-base font-semibold text-white">
      {initial}
    </span>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { isAuthenticated, user, plan, role, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };

    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const hasInstitutionAccess = plan === "institution" || role === "admin";

  const navigation = isAuthenticated
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/report", label: "Reports" },
        ...(hasInstitutionAccess ? [{ href: "/institution", label: "Institution" }] : []),
        { href: "/pricing", label: "Plans" },
        { href: "/settings", label: "Settings" },
      ]
    : [
        { href: "/", label: "Overview" },
        { href: "/pricing", label: "Pricing" },
        { href: "/login", label: "Login" },
      ];

  const handleLogout = async () => {
    logout();
    await router.push("/");
  };

  return (
    <header className="section-card section-card--compact relative isolate z-40 mt-2 w-full px-6 py-4">
      <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-4 md:flex-nowrap">
        <div className="flex flex-1 items-center gap-4 md:flex-none md:min-w-[300px]">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-100/70">
            <Image
              src="/med-analyzr-ai-logo.png"
              alt="Med Analyzr AI logo"
              width={40}
              height={40}
              priority
            />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-lg font-semibold leading-tight text-ocean">Med Analyzr AI</p>
              {isAuthenticated && (
                <span className="rounded-full border border-teal/30 bg-gradient-to-r from-teal/10 to-teal/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-teal/80 shadow-inner">
                  {plan === "institution" ? "Institution" : plan === "clinician" ? "Clinician" : "Individual"} plan
                </span>
              )}
            </div>
            <p className="text-xs text-ocean/60 md:text-sm">Clinical intelligence that meets you where you work</p>
          </div>
        </div>

        <nav className="order-3 hidden w-full items-center justify-center gap-1.5 rounded-full bg-white/60 p-1 shadow-inner shadow-white/60 md:order-none md:flex md:flex-1">
          {navigation.map((link) => {
            const isActive = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-full px-5 py-2 text-sm font-semibold tracking-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal/60",
                  isActive
                    ? "bg-white text-teal shadow"
                    : "text-ocean/70 hover:bg-white hover:text-teal"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-sand/70 p-2 text-ocean/60 transition hover:border-teal/60 hover:text-teal md:hidden"
            onClick={() => setMobileOpen((value) => !value)}
          >
            <span className="sr-only">Toggle navigation</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-6 w-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="hidden md:flex">
            {isAuthenticated ? (
              <div className="relative inline-flex" ref={menuRef}>
                <button
                  type="button"
                  className="inline-flex items-center gap-4 rounded-full border border-white/70 bg-white/70 px-4 py-2.5 text-sm text-ocean shadow-sm ring-1 ring-slate-100 transition hover:border-teal/50 hover:text-teal"
                  onClick={() => setProfileOpen((value) => !value)}
                >
                  <UserAvatar email={user?.email} />
                  <div className="text-left">
                    <p className="text-xs uppercase tracking-[0.18em] text-ocean/50">
                      {plan === "institution" ? "Institution admin" : plan === "clinician" ? "Clinician" : "Individual"}
                    </p>
                    <p className="text-sm font-semibold text-ocean">{user?.email}</p>
                  </div>
                  <ChevronDownIcon className="h-4 w-4 text-ocean/40" aria-hidden />
                </button>

                {profileOpen && (
                  <div className="section-card section-card--compact absolute right-0 top-16 w-64 p-4">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ocean transition hover:bg-teal/10 hover:text-teal"
                      onClick={() => setProfileOpen(false)}
                    >
                      <UserCircleIcon className="h-4 w-4" aria-hidden />
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ocean transition hover:bg-teal/10 hover:text-teal"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Cog6ToothIcon className="h-4 w-4" aria-hidden />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ocean transition hover:bg-red-100 hover:text-red-500"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-full border border-sand/70 px-4 py-2 text-sm font-semibold text-ocean transition hover:border-teal/60 hover:bg-white hover:text-teal"
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="mt-4 flex flex-col gap-2 rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-2xl md:hidden">
          {navigation.map((link) => {
            const isActive = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-teal/10 text-teal" : "text-ocean/80 hover:bg-sand/60"
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-200"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          ) : (
            <Fragment>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl border border-sand/70 px-3 py-2 text-center text-sm font-medium text-ocean transition hover:border-teal/60 hover:text-teal"
              >
                Log in
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl bg-teal px-3 py-2 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90"
              >
                Get started
              </Link>
            </Fragment>
          )}
        </div>
      )}
    </header>
  );
}
