import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/lib/auth-actions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Webtomate
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <Link className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" href="/dashboard">
                Dashboard
              </Link>
              <Link
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                href="/dashboard/automations"
              >
                Automations
              </Link>
              <Link className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" href="/dashboard/api">
                API
              </Link>
            </nav>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-5xl px-4 py-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
          </main>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}
