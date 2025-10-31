import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/report", label: "Reports" },
  { href: "/login", label: "Login" },
];

export default function Navbar() {
  const router = useRouter();

  return (
    <header className="w-full py-4 px-6 bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl shadow-soft flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-white to-silver border border-white/70 flex items-center justify-center shadow-sm">
          <span className="text-midnight font-semibold">AI</span>
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight">AI Medical Analyzer</p>
          <p className="text-sm text-gray-500">Insights at a glance</p>
        </div>
      </div>
      <nav className="hidden md:flex items-center gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "text-sm font-medium text-gray-600 transition-colors hover:text-midnight",
              router.pathname === link.href && "text-midnight"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-midnight text-white text-sm font-medium shadow-lg shadow-midnight/20 transition hover:shadow-midnight/40"
      >
        Get Started
      </Link>
    </header>
  );
}
