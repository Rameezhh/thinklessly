"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, SearchIcon } from "@/components/brand/icons";
import { StatusPill } from "@/components/ui/status-pill";

export type AutomationRow = {
  id: string;
  name: string;
  status: string;
  url: string | null;
  updatedAt: string;
  lastRun: { id: string; status: string; createdAt: string } | null;
};

type Filter = "all" | "active" | "failed";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "failed", label: "Failed" },
];

export function AutomationsList({ automations }: { automations: AutomationRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return automations.filter((automation) => {
      const matchesQuery =
        !needle ||
        automation.name.toLowerCase().includes(needle) ||
        (automation.url ?? "").toLowerCase().includes(needle);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && automation.status === "ACTIVE") ||
        (filter === "failed" &&
          (automation.status === "FAILED" || automation.lastRun?.status === "FAILED"));
      return matchesQuery && matchesFilter;
    });
  }, [automations, filter, query]);

  return (
    <div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-[1_1_280px]">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7A7E8C]"
          />
          <label htmlFor="automation-search" className="sr-only">
            Search automations
          </label>
          <input
            id="automation-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search automations"
            className="field pl-11 text-[15px]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`inline-flex h-11 items-center rounded-full px-4.5 text-[14px] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-[#0E0F13] text-white shadow-[0_8px_20px_rgba(14,15,19,0.16)]"
                    : "border-[1.5px] border-[#D8D6CE] bg-white text-[#14151A] hover:border-[#9c988d] hover:bg-[#FBFBF9]"
                }`}
                aria-pressed={active}
              >
                {item.label}
                {item.id === "all" ? ` · ${automations.length}` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div key={`${filter}:${query}`} className="animate-fade mt-6 flex flex-col gap-3.5">
        {automations.length === 0 ? (
          <div className="rounded-3xl border-[1.5px] border-dashed border-[#D8D6CE] bg-[#FBFBF9] px-6 py-14 text-center">
            <p className="display text-[26px] tracking-[-0.02em]">No automations yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#5C6070]">
              Record your first flow in a real browser, or import a definition JSON document.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Link href="/dashboard/automations/create" className="btn btn-dark btn-sm">
                Create automation
              </Link>
              <Link href="/dashboard/automations/import" className="btn btn-outline btn-sm">
                Import JSON
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border-[1.5px] border-dashed border-[#D8D6CE] bg-[#FBFBF9] px-6 py-12 text-center">
            <p className="text-base font-semibold">No automations match this view</p>
            <p className="mt-1 text-sm text-[#5C6070]">Try another search term or filter.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="btn btn-outline btn-sm mt-4"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((automation) => {
            const lastRun = automation.lastRun;
            return (
              <div
                key={automation.id}
                className="hover-lift flex flex-wrap items-center gap-5 rounded-[20px] border border-[#E5E4DE] bg-white px-6 py-[22px]"
              >
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/dashboard/automations/${automation.id}`}
                      className="text-[18px] font-semibold tracking-[-0.01em] transition-colors hover:text-[#3F5A00]"
                    >
                      {automation.name}
                    </Link>
                    <StatusPill status={automation.status} />
                  </div>
                  <div className="mono mt-1.5 truncate text-[12px] text-[#5C6070]">
                    {automation.url ?? "No start URL"} · updated {automation.updatedAt}
                  </div>
                </div>

                <div className="flex min-w-[180px] flex-1 items-center gap-2.5 text-[14px] text-[#5C6070] lg:flex-none">
                  Last run
                  {lastRun ? (
                    <Link href={`/dashboard/runs/${lastRun.id}`}>
                      <StatusPill status={lastRun.status} />
                    </Link>
                  ) : (
                    <span className="pill pill-neutral">NEVER</span>
                  )}
                </div>

                <Link
                  href={`/dashboard/automations/${automation.id}`}
                  className="btn btn-outline btn-sm group"
                >
                  Open
                  <ArrowRightIcon
                    size={14}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}