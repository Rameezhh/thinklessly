const runs = [
  { name: "Scrape orders table", meta: "API · 12:40", status: "SUCCESS" },
  { name: "Login and export report", meta: "MANUAL · 11:05", status: "SUCCESS" },
  { name: "Track shipment status", meta: "MANUAL · 09:48", status: "FAILED" },
];

export function SignInBrand() {
  return (
    <div className="dot-grid flex h-full flex-col justify-center gap-10 px-6 py-14 text-white sm:px-14">
      <div className="max-w-[520px] animate-rise">
        <div className="mono text-[12px] font-medium tracking-[0.08em] text-[#C8F23B]">
          RECORD ONCE, RUN ANYWHERE
        </div>
        <h2 className="display mt-4 text-[40px] leading-[1.05] sm:text-[48px]">
          Your automations keep running while you are away.
        </h2>
      </div>

      <div className="stagger w-full max-w-[520px] overflow-hidden rounded-[20px] border border-[#2A2D38] bg-[#14161C]">
        <div className="mono border-b border-[#2A2D38] px-5 py-4 text-[12px] tracking-[0.06em] text-[#A3A7B5]">
          RECENT RUNS
        </div>
        {runs.map((run, index) => (
          <div
            key={run.name}
            className={`flex items-center justify-between gap-3 px-5 py-4 ${
              index < runs.length - 1 ? "border-b border-[#22252F]" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium">{run.name}</div>
              <div className="mono mt-0.5 text-[12px] text-[#8A8E9E]">{run.meta}</div>
            </div>
            <span
              className={`mono shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] ${
                run.status === "SUCCESS"
                  ? "bg-[#12301F] text-[#5BE49B]"
                  : "bg-[#3A1613] text-[#FF8A80]"
              }`}
            >
              {run.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}