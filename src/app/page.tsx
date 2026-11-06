import { CallToAction } from "@/components/marketing/cta";
import { Developers } from "@/components/marketing/developers";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function Home() {
  return (
    <div className="bg-[#0E0F13]">
      <Hero />
      <HowItWorks />
      <Features />
      <Developers />
      <CallToAction />
      <SiteFooter />
    </div>
  );
}