import { CopyButton } from "@/components/ui/copy-button";

export function QuickStart({ baseUrl }: { baseUrl: string }) {
  const startRun = `curl -X POST ${baseUrl}/api/v1/automations/<automation-id>/runs \\
  -H "Authorization: Bearer wtm_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-123" \\
  -d '{"inputs":{},"secrets":{}}'`;

  const fetchRun = `curl -H "Authorization: Bearer wtm_..." \\
  "${baseUrl}/api/v1/runs/<run-id>?wait=30"`;

  const cancelRun = `curl -X POST -H "Authorization: Bearer wtm_..." \\
  ${baseUrl}/api/v1/runs/<run-id>/cancel`;

  const sections = [
    { label: "START A RUN", content: startRun },
    { label: "FETCH A RUN AND WAIT UP TO 30 SECONDS", content: fetchRun },
    { label: "CANCEL A RUN", content: cancelRun },
  ];

  return (
    <div className="space-y-6 px-7 py-6">
      {sections.map((section) => (
        <div key={section.label}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="mono text-[11px] uppercase tracking-[0.06em] text-[#5C6070]">
              {section.label}
            </span>
            <CopyButton
              value={section.content}
              label="Copy"
              copiedLabel="Copied"
              className="btn btn-outline btn-xs"
            />
          </div>
          <pre className="code-block text-[13px]">{section.content}</pre>
        </div>
      ))}
    </div>
  );
}