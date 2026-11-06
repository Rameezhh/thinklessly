"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardIcon, BoltIcon, CodeIcon, LogOutIcon, CloseIcon } from "@/components/brand/icons";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/lib/auth-actions";

type SidebarUser = {
  name: string;
  email: string;
};

const items = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
    match: (path: string) => path === "/dashboard",
  },
  {
    href: "/dashboard/automations",
    label: "Automations",
    icon: BoltIcon,
    match: (path: string) => path.startsWith("/dashboard/automations") || path.startsWith("/dashboard/runs"),
  },
  {
    href: "/dashboard/api",
    label: "API",
    icon: CodeIcon,
    match: (path: string) => path.startsWith("/dashboard/api"),
  },
];

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="App" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            className="nav-item"
            onClick={onNavigate}
          >
            <Icon size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBlock({ user }: { user: SidebarUser }) {
  return (
    <div className="mt-auto border-t border-[#20222B] pt-[18px]">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#C8F23B] font-bold text-[#0E0F13]">
            {user.name.trim().charAt(0).toUpperCase() || "T"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-white">{user.name}</div>
            <div className="truncate text-[12px] text-[#8A8E9E]">{user.email}</div>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-xl border border-[#2A2D38] px-3.5 py-2.5 text-[14px] font-medium text-[#B4B8C6] transition-colors hover:bg-[#1E2028] hover:text-white"
          >
            <LogOutIcon size={18} />
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export function SidebarNav({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-7 bg-[#0E0F13] px-4 py-6 text-white lg:flex">
        <Link href="/dashboard" aria-label="Thinklessly dashboard" className="px-2">
          <Logo size={32} wordmarkSize={20} wordmarkColor="#FFFFFF" />
        </Link>
        <NavList pathname={pathname} />
        <UserBlock user={user} />
      </aside>

      <div className="sticky top-0 z-40 flex items-center justify-between bg-[#0E0F13] px-5 py-3 text-white lg:hidden">
        <Link href="/dashboard" aria-label="Thinklessly dashboard">
          <Logo size={30} wordmarkSize={19} wordmarkColor="#FFFFFF" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2A2D38] text-white transition-colors hover:bg-[#1E2028]"
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="animate-fade absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <div className="animate-slide-left absolute inset-y-0 left-0 flex w-[280px] flex-col gap-7 bg-[#0E0F13] px-4 py-6 text-white shadow-2xl">
            <div className="flex items-center justify-between px-2">
              <Link href="/dashboard" aria-label="Thinklessly dashboard" onClick={() => setOpen(false)}>
                <Logo size={30} wordmarkSize={19} wordmarkColor="#FFFFFF" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#B4B8C6] transition-colors hover:bg-[#1E2028] hover:text-white"
                aria-label="Close navigation"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <UserBlock user={user} />
          </div>
        </div>
      ) : null}
    </>
  );
}