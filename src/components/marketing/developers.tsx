import { CheckCircleIcon } from "@/components/brand/icons";
import { Reveal } from "@/components/marketing/reveal";

const bullets = [
  "API keys are hashed and shown once",
  "Idempotency keys for safe retries",
  "HMAC-SHA256 signed webhooks",
];

export function Developers() {
  return (
    <section id="developers" className="scroll-mt-6 bg-[#0E0F13] px-6 py-20 text-white sm:px-8 sm:py-[120px]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 lg:gap-14">
        <Reveal className="min-w-0 flex-[1_1_400px]">
          <div>
            <div className="mono text-[12px] tracking-[0.08em] text-[#C8F23B]">
              FOR DEVELOPERS
            </div>
            <h2
              className="display mt-3.5 text-balance tracking-[-0.035em]"
              style={{ fontSize: "clamp(34px, 4.6vw, 56px)" }}
            >
              Run it from wherever your code lives.
            </h2>
            <p className="mt-5 max-w-[480px] text-[17px] leading-[1.6] text-[#B4B8C6]">
              Every automation has an endpoint. Pass inputs and secrets, wait up to 30 seconds for
              the result, or let the webhook tell you when it is done.
            </p>
            <div className="mt-7 flex flex-col gap-3.5">
              {bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-3 text-base text-[#E6E8EF]">
                  <CheckCircleIcon size={20} className="shrink-0 text-[#C8F23B]" />
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={120} className="min-w-0 flex-[1_1_520px]">
          <div className="overflow-hidden rounded-[20px] border border-[#2A2D38] bg-[#14161C]">
            <div className="flex items-center gap-2 border-b border-[#2A2D38] px-4.5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2F3340]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2F3340]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2F3340]" />
              <span className="mono ml-2.5 text-[12px] text-[#A3A7B5]">start-a-run.sh</span>
            </div>
            <pre className="mono m-0 overflow-x-auto whitespace-pre-wrap p-6 text-[13px] leading-[1.8] text-[#D5D8E2]">
              <span className="text-[#C8F23B]">curl</span>
              {` -X POST https://app.thinklessly.com/api/v1/automations/<automation-id>/runs \\\n  -H "Authorization: Bearer wtm_..." \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: order-123" \\\n  -d '{"inputs":{},"secrets":{}}'\n\n`}
              <span className="text-[#7C8092]">
                {"# fetch the result, waiting up to 30 seconds\n"}
              </span>
              <span className="text-[#C8F23B]">curl</span>
              {` -H "Authorization: Bearer wtm_..." \\\n  "https://app.thinklessly.com/api/v1/runs/<run-id>?wait=30"`}
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}