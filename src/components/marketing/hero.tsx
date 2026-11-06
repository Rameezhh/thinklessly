import Link from "next/link";
import { ArrowRightIcon } from "@/components/brand/icons";
import { ProductVisual } from "@/components/marketing/product-visual";
import { Reveal } from "@/components/marketing/reveal";
import { SiteHeader } from "@/components/marketing/site-header";

export function Hero() {
  return (
    <section className="dot-grid overflow-hidden bg-[#0E0F13] text-white">
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-6 pb-0 pt-14 text-center sm:px-8 sm:pt-[72px]">
        <div
          className="animate-rise mono inline-flex items-center gap-2 rounded-full border border-[#2A2D38] px-3.5 py-[7px] text-[11px] uppercase tracking-[0.06em] text-[#C9CCD6] sm:text-[12px]"
          style={{ animationDelay: "40ms" }}
        >
          <span className="h-2 w-2 rounded-full bg-[#C8F23B]" />
          Browser automation, minus the code
        </div>

        <h1
          className="animate-rise display mx-auto mt-7 max-w-[920px] text-balance leading-[1] tracking-[-0.04em]"
          style={{ animationDelay: "100ms", fontSize: "clamp(44px, 7.4vw, 92px)" }}
        >
          Record it once.
          <br />
          <span className="text-[#C8F23B]">Run it anywhere.</span>
        </h1>

        <p
          className="animate-rise mx-auto mt-7 max-w-[640px] text-[17px] leading-[1.55] text-[#B4B8C6] sm:text-[19px]"
          style={{ animationDelay: "170ms" }}
        >
          Thinklessly records your clicks in a real browser, captures tables and lists as clean
          JSON, then runs the whole flow on demand from your dashboard or a single API call.
        </p>

        <div
          className="animate-rise mt-9 flex flex-wrap justify-center gap-3"
          style={{ animationDelay: "240ms" }}
        >
          <Link href="/register" className="btn btn-lime btn-lg group">
            Start automating
            <ArrowRightIcon
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
          <a href="#how" className="btn btn-lg border-[#343846] bg-transparent text-white hover:bg-white/5">
            See how it works
          </a>
        </div>

        <Reveal delay={120}>
          <ProductVisual />
        </Reveal>
      </div>
    </section>
  );
}