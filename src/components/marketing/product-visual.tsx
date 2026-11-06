const rows = [
  { order: "#10482", customer: "Amara Khan", total: "$120.00" },
  { order: "#10481", customer: "Daniel Ortiz", total: "$86.40" },
  { order: "#10480", customer: "Mei Tanaka", total: "$240.00" },
  { order: "#10479", customer: "Sofia Rossi", total: "$58.25" },
];

export function ProductVisual() {
  return (
    <div className="mx-auto mt-16 flex max-w-[1120px] flex-wrap items-stretch gap-5 text-left sm:mt-[72px]">
      <div className="relative min-w-0 flex-[1_1_560px] overflow-hidden rounded-t-[20px] border border-b-0 border-[#2A2D38] bg-white text-[#14151A] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3.5 border-b border-[#E5E4DE] bg-[#F1F0EB] px-4.5 py-3.5">
          <div className="flex gap-1.5">
            <span className="h-[11px] w-[11px] rounded-full bg-[#D8D6CE]" />
            <span className="h-[11px] w-[11px] rounded-full bg-[#D8D6CE]" />
            <span className="h-[11px] w-[11px] rounded-full bg-[#D8D6CE]" />
          </div>
          <div className="mono flex-1 truncate rounded-full border border-[#E5E4DE] bg-white px-3.5 py-1.5 text-[12px] text-[#5C6070]">
            portal.example.com/orders
          </div>
        </div>

        <div className="relative px-5 pb-24 pt-7 sm:px-7">
          <div className="display text-[22px] font-bold tracking-[-0.02em]">Orders</div>
          <div className="relative mt-4 rounded-xl border-2 border-dashed border-[#7FA10A] bg-[#FAFDEB] p-1.5">
            <span className="mono absolute -top-3 left-3.5 rounded-full bg-[#0E0F13] px-2.5 py-[3px] text-[11px] tracking-[0.04em] text-[#C8F23B]">
              TABLE · 4 ROWS
            </span>
            <div className="flex px-3 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5C6070] sm:text-[12px]">
              <span className="flex-1">Order</span>
              <span className="flex-[1.4]">Customer</span>
              <span className="flex-1 text-right">Total</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.order}
                className="flex border-t border-[#E3EBC2] px-3 py-2.5 text-[13px] transition-colors hover:bg-[#F4F9DF] sm:text-[14px]"
              >
                <span className="flex-1 font-medium">{row.order}</span>
                <span className="flex-[1.4]">{row.customer}</span>
                <span className="flex-1 text-right">{row.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-[22px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#0E0F13] p-2 shadow-[0_12px_32px_rgba(14,15,19,0.35)]">
          <span className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-white">
            <span className="animate-pulse-dot h-[9px] w-[9px] rounded-full bg-[#FF5A4D]" />
            Recording
          </span>
          <span className="cursor-pointer rounded-[10px] bg-[#C8F23B] px-3 py-2 text-[13px] font-semibold text-[#0E0F13] transition-transform hover:-translate-y-0.5">
            Capture data
          </span>
          <span className="cursor-default px-3 py-2 text-[13px] font-medium text-[#C9CCD6]">
            End automation
          </span>
        </div>
      </div>

      <div className="flex min-w-[260px] flex-[0_1_380px] flex-col gap-4 self-center rounded-[20px] border border-[#2A2D38] bg-[#14161C] p-[22px]">
        <div className="flex items-center justify-between gap-3">
          <span className="mono text-[12px] tracking-[0.06em] text-[#A3A7B5]">RUN RESULT</span>
          <span className="rounded-full bg-[#12301F] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-[#5BE49B]">
            SUCCESS
          </span>
        </div>
        <pre className="mono m-0 whitespace-pre-wrap text-[13px] leading-[1.7] text-[#D5D8E2]">
          <span>{"{\n  "}</span>
          <span className="text-[#C8F23B]">&quot;rows&quot;</span>
          <span>{": [\n    { "}</span>
          <span className="text-[#8FA0FF]">&quot;order&quot;</span>
          <span>{': "#10482",\n      '}</span>
          <span className="text-[#8FA0FF]">&quot;customer&quot;</span>
          <span>{': "Amara Khan",\n      '}</span>
          <span className="text-[#8FA0FF]">&quot;total&quot;</span>
          <span>{': "$120.00" },\n    { '}</span>
          <span className="text-[#8FA0FF]">&quot;order&quot;</span>
          <span>{': "#10481",\n      '}</span>
          <span className="text-[#8FA0FF]">&quot;customer&quot;</span>
          <span>{': "Daniel Ortiz",\n      '}</span>
          <span className="text-[#8FA0FF]">&quot;total&quot;</span>
          <span>{': "$86.40" },\n    ...\n  ]\n}'}</span>
        </pre>
      </div>
    </div>
  );
}