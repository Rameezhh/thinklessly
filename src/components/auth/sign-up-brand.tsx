import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const steps = [
  {
    title: "Record a flow in a real browser",
    description: "Click through any website once and Thinklessly remembers every step.",
  },
  {
    title: "Capture tables, lists and cards as JSON",
    description: "Fresh, structured data on every run, ready for your code.",
  },
  {
    title: "Run it from the dashboard or an API",
    description: "Use an API key and signed webhooks to plug it into anything.",
  },
];

export function SignUpBrand() {
  return (
    <div className="dot-grid flex h-full flex-col px-6 py-10 text-white sm:px-14">
      <Link href="/" aria-label="Thinklessly home" className="self-start">
        <Logo size={34} wordmarkSize={22} wordmarkColor="#FFFFFF" />
      </Link>

      <div className="flex max-w-[520px] flex-1 flex-col justify-center gap-11 py-12">
        <h2 className="animate-rise display text-[42px] leading-[1.03] sm:text-[52px]">
          Automate the clicks.
          <br />
          <span className="text-[#C8F23B]">Keep the data.</span>
        </h2>
        <div className="stagger flex flex-col gap-[22px]">
          {steps.map((step, index) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1E2028] text-[14px] text-[#C8F23B]">
                {index + 1}
              </div>
              <div>
                <div className="text-[17px] font-semibold">{step.title}</div>
                <div className="mt-1 text-[15px] leading-[1.55] text-[#A3A7B5]">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[13px] text-[#7C8092]">© 2026 Thinklessly</div>
    </div>
  );
}