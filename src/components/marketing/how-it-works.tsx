import { Reveal } from "@/components/marketing/reveal";

const steps = [
  {
    title: "Record",
    description:
      "Enter a starting URL. The real site opens in a new tab with a floating toolbar, and every click and field you use becomes a step.",
  },
  {
    title: "Capture",
    description:
      "Point at any table, list, card or section and save it. Thinklessly re-reads it as fresh JSON on every single run.",
  },
  {
    title: "Run",
    description:
      "Press run in the dashboard or trigger it from your own code with an API key. Results land in your app through a signed webhook.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-6 bg-[#F7F7F4] px-6 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <div className="eyebrow">HOW IT WORKS</div>
          <h2
            className="display mt-3.5 max-w-[680px] text-balance tracking-[-0.035em]"
            style={{ fontSize: "clamp(34px, 4.6vw, 56px)" }}
          >
            Three steps. Zero scripts.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 100}>
              <div className="hover-lift h-full rounded-3xl border border-[#E5E4DE] bg-white p-8">
                <div className="mono flex h-11 w-11 items-center justify-center rounded-full bg-[#0E0F13] text-[14px] font-medium text-[#C8F23B]">
                  {index + 1}
                </div>
                <h3 className="display mt-7 text-[26px] font-bold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-[1.6] text-[#4A4E5C]">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}