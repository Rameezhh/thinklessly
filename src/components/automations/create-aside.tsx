const steps = [
  {
    number: 2,
    title: "Record your steps",
    description: "Click, type and navigate as you normally would.",
  },
  {
    number: 3,
    title: "Capture what you need",
    description: "Save tables, lists, cards or sections as JSON.",
  },
  {
    number: 4,
    title: "End the automation",
    description: "Close the tab and return here to run it.",
  },
];

export function CreateAside() {
  return (
    <aside className="h-fit rounded-3xl bg-[#0E0F13] p-8 text-white">
      <div className="mono text-[12px] tracking-[0.08em] text-[#C8F23B]">WHAT HAPPENS NEXT</div>
      <div className="stagger mt-6 flex flex-col gap-[22px]">
        {steps.map((step) => (
          <div key={step.number} className="flex gap-3.5">
            <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E2028] text-[12px] text-[#C8F23B]">
              {step.number}
            </span>
            <div>
              <div className="text-base font-semibold">{step.title}</div>
              <div className="mt-1 text-sm leading-[1.55] text-[#A3A7B5]">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}