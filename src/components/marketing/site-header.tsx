import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const nav = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#developers", label: "Developers" },
];

export function SiteHeader() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 py-[22px]">
        <Link href="/" aria-label="Thinklessly home" className="transition-opacity hover:opacity-90">
          <Logo size={34} wordmarkSize={22} wordmarkColor="#FFFFFF" />
        </Link>

        <nav aria-label="Primary" className="flex flex-wrap items-center gap-6 text-[15px] text-[#C9CCD6] sm:gap-7">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative transition-colors duration-200 hover:text-white after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-[#C8F23B] after:transition-all after:duration-300 hover:after:w-full"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-white/5"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-[#C8F23B] px-5 py-2.5 text-[15px] font-semibold text-[#0E0F13] transition-all duration-200 hover:bg-[#d4ff4a] hover:shadow-[0_10px_28px_rgba(200,242,59,0.25)] active:scale-[0.98]"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}