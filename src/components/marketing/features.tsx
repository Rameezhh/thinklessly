import { Reveal } from "@/components/marketing/reveal";

function RecordIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 10h18M9 10v10" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" />
    </svg>
  );
}

function WebhookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3.5 3.5 0 010 7M18 14.5c1.8.7 3 2.5 3 5.5" />
    </svg>
  );
}

const smallFeatures = [
  {
    icon: BoltIcon,
    title: "One call to run",
    description:
      "Start, fetch and cancel runs with an API key. Idempotency keys make retries safe.",
  },
  {
    icon: WebhookIcon,
    title: "Signed webhooks",
    description:
      "A POST arrives when a run finishes, signed with HMAC-SHA256 so you can verify it.",
  },
  {
    icon: LockIcon,
    title: "Secrets stay secret",
    description:
      "Secrets are encrypted in transit and in storage, and are never returned.",
  },
  {
    icon: TeamIcon,
    title: "Built for teams",
    description:
      "Work in a shared team space with roles, so everyone sees the same automations.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-6 bg-[#F7F7F4] px-6 pb-20 sm:px-8 sm:pb-[120px]">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <div className="eyebrow">FEATURES</div>
          <h2
            className="display mt-3.5 max-w-[720px] text-balance tracking-[-0.035em]"
            style={{ fontSize: "clamp(34px, 4.6vw, 56px)" }}
          >
            Everything a real workflow needs.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:mt-14 lg:grid-cols-2">
          <Reveal>
            <div className="hover-lift flex h-full flex-col gap-5 rounded-3xl border border-[#E5E4DE] bg-white p-9">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F1F0EB] text-[#0E0F13]">
                <RecordIcon />
              </div>
              <h3 className="display text-[30px] font-bold tracking-[-0.025em]">
                Record in a real browser
              </h3>
              <p className="max-w-[460px] text-base leading-[1.6] text-[#4A4E5C]">
                Click through the live site exactly as you would yourself. Every navigation, click
                and typed field turns into a replayable step.
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {["open_page", "click", "type"].map((tag) => (
                  <span
                    key={tag}
                    className="mono rounded-full bg-[#F1F0EB] px-3.5 py-2 text-[12px] text-[#14151A]"
                  >
                    {tag}
                  </span>
                ))}
                <span className="mono rounded-full bg-[#EEF9C8] px-3.5 py-2 text-[12px] text-[#3F5A00]">
                  capture_table
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="hover-lift flex h-full flex-col gap-5 rounded-3xl bg-[#0E0F13] p-9 text-white">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#1E2028] text-[#C8F23B]">
                <DataIcon />
              </div>
              <h3 className="display text-[30px] font-bold tracking-[-0.025em]">
                Fresh JSON on every run
              </h3>
              <p className="max-w-[460px] text-base leading-[1.6] text-[#B4B8C6]">
                Save any table, list, card or section. It is captured again each time the automation
                runs, so your data is never stale.
              </p>
              <div className="mt-auto flex flex-wrap gap-2.5 pt-2">
                {["Tables", "Lists", "Cards", "Sections"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#343846] px-3.5 py-2 text-[13px] text-[#D5D8E2]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {smallFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={index * 80}>
                <div className="hover-lift h-full rounded-3xl border border-[#E5E4DE] bg-white p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F0EB] text-[#0E0F13]">
                    <Icon />
                  </div>
                  <h3 className="display mt-5 text-[21px] font-bold tracking-[-0.02em]">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-[1.6] text-[#4A4E5C]">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}