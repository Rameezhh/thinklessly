"use client";

import { Bot, Code2, LayoutDashboard, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const items: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (path) => path === "/dashboard",
  },
  {
    href: "/dashboard/automations",
    label: "Automations",
    icon: Bot,
    match: (path) => path.startsWith("/dashboard/automations") || path.startsWith("/dashboard/runs"),
  },
  {
    href: "/dashboard/api",
    label: "API",
    icon: Code2,
    match: (path) => path.startsWith("/dashboard/api"),
  },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              active
                ? "bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-600/5 dark:bg-indigo-950/60 dark:text-indigo-300"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
