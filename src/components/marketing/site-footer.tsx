import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#20222B] bg-[#0E0F13] px-6 py-9 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-5">
        <Link href="/" aria-label="Thinklessly home" className="transition-opacity hover:opacity-90">
          <Logo size={28} wordmarkSize={18} wordmarkColor="#FFFFFF" />
        </Link>

        <div className="flex flex-wrap gap-6 text-[14px] text-[#A3A7B5]">
          <a href="#how" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#developers" className="transition-colors hover:text-white">
            Developers
          </a>
          <Link href="/login" className="transition-colors hover:text-white">
            Sign in
          </Link>
        </div>

        <div className="text-[14px] text-[#8A8E9E]">© 2026 Thinklessly. All rights reserved.</div>
      </div>
    </footer>
  );
}