import type { AutomationDefinition, ExtractField, Step } from "@shared/definition";

function stepDetail(step: Step): string | null {
  switch (step.type) {
    case "goto":
      return step.url;
    case "fill":
      return step.value.mode === "field" ? `field: ${step.value.key}` : step.value.text;
    case "select":
      return step.value;
    case "check":
      return step.checked ? "checked" : "unchecked";
    case "upload":
      return `field: ${step.fieldKey}`;
    case "press":
      return step.key;
    case "wait":
      return `${step.kind}: ${String(step.value)}`;
    case "extract":
      return `output: ${step.outputKey}`;
    case "extractStructured":
      return `JSON output: ${step.root.key}`;
    case "screenshot":
      return step.name;
    case "assert":
      return [step.kind, step.value].filter(Boolean).join(" ");
    default:
      return null;
  }
}

function selectorsFor(step: Step) {
  return "selectors" in step && step.selectors ? step.selectors : [];
}

function fieldLines(field: ExtractField, depth = 0): string[] {
  const kind =
    field.kind === "value"
      ? `${field.attribute || "text"}`
      : field.kind === "list"
        ? `list ≤${field.limit}`
        : "object";
  const lines = [`${"  ".repeat(depth)}${field.key}: ${kind}`];
  if (field.kind !== "value") {
    for (const child of field.fields) lines.push(...fieldLines(child, depth + 1));
  }
  return lines;
}

export function DefinitionView({ definition }: { definition: AutomationDefinition }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inputs</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Values are supplied at run time. Secrets are encrypted at rest and never shown again.
          </p>
        </div>
        {definition.fields.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">No inputs.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-2 font-medium">Label</th>
                <th className="px-5 py-2 font-medium">Key</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {definition.fields.map((field) => (
                <tr key={field.key}>
                  <td className="px-5 py-2 text-zinc-900 dark:text-zinc-100">{field.label}</td>
                  <td className="px-5 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{field.key}</td>
                  <td className="px-5 py-2 text-zinc-600 dark:text-zinc-400">{field.type}</td>
                  <td className="px-5 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {[field.required ? "required" : "optional", field.secret ? "secret" : null]
                      .filter(Boolean)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Steps</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {definition.steps.length} step(s) · start URL: {definition.startUrl}
          </p>
        </div>
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {definition.steps.map((step, index) => {
            const selectors = selectorsFor(step);
            const detail = stepDetail(step);
            return (
              <li key={step.id} className="flex gap-4 px-5 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {step.type}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {step.label ?? step.id}
                    </span>
                    {!step.enabled ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">disabled</span>
                    ) : null}
                    {step.optional ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">optional</span>
                    ) : null}
                  </div>
                  {detail ? (
                    <p className="mt-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>
                  ) : null}
                  {selectors.length > 0 ? (
                    <p className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {selectors[0].kind}: {selectors[0].value}
                      {selectors.length > 1 ? ` (+${selectors.length - 1} fallback)` : ""}
                    </p>
                  ) : null}
                  {step.type === "extractStructured" ? (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      {fieldLines(step.root).join("\n")}
                    </pre>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
