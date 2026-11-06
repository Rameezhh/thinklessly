import Link from "next/link";
import { ArrowRightIcon } from "@/components/brand/icons";
import { Reveal } from "@/components/marketing/reveal";

export function CallToAction() {
  return (
    <div className="bg-[#0E0F13] px-6 pb-20 sm:px-8 sm:pb-24">
      <Reveal className="mx-auto max-w-[1200px]">
        <div className="rounded-[32px] bg-[#C8F23B] px-6 py-16 text-center text-[#0E0F13] sm:px-10 sm:py-[72px]">
          <h2
            className="display mx-auto max-w-[760px] text-balance tracking-[-0.04em]"
            style={{ fontSize: "clamp(36px, 5.4vw, 68px)", lineHeight: 1.02 }}
          >
            Stop clicking. Start shipping.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.55] text-[#2B3A00] sm:text-[18px]">
            Record your first automation in minutes and run it from anywhere.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn btn-dark btn-lg group">
              Create your account
              <ArrowRightIcon
                size={16}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="/login"
              className="btn btn-lg border-[1.5px] border-[#0E0F13] bg-transparent text-[#0E0F13] hover:bg-[#0E0F13]/5"
            >
              Sign in
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}