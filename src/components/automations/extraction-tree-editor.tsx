"use client";

import { outputKeySchema, type ExtractField } from "@shared/definition";
import { validateStructuredField } from "@shared/outputs";

type Props = {
  root: ExtractField;
  onChange: (root: ExtractField) => void;
  disabled?: boolean;
};

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900";

function validKey(value: string): boolean {
  return outputKeySchema.safeParse(value).success;
}

function withKey(field: ExtractField, key: string): ExtractField {
  return { ...field, key };
}

function updateChild(fields: ExtractField[], index: number, next: ExtractField): ExtractField[] {
  return fields.map((field, current) => (current === index ? next : field));
}

function removeChild(fields: ExtractField[], index: number): ExtractField[] {
  return fields.filter((_, current) => current !== index);
}

function FieldEditor({
  field,
  onChange,
  onRemove,
  isRoot = false,
  disabled = false,
}: {
  field: ExtractField;
  onChange: (field: ExtractField) => void;
  onRemove?: () => void;
  isRoot?: boolean;
  disabled?: boolean;
}) {
  const keyValid = validKey(field.key);
  const children = field.kind === "value" ? [] : field.fields;

  return (
    <div
      className={`rounded-lg border p-3 ${
        isRoot
          ? "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
          : "border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {isRoot ? "Output / JSON key" : field.kind === "list" ? "List key" : "Field key"}
          </span>
          <input
            value={field.key}
            onChange={(event) => onChange(withKey(field, event.target.value))}
            disabled={disabled}
            spellCheck={false}
            className={`${inputClass} ${keyValid ? "" : "border-red-400 dark:border-red-700"}`}
          />
        </label>

        {field.kind === "value" ? (
          <label className="flex w-32 flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Attribute
            </span>
            <input
              value={field.attribute}
              onChange={(event) => onChange({ ...field, attribute: event.target.value })}
              disabled={disabled}
              spellCheck={false}
              className={inputClass}
            />
          </label>
        ) : null}

        {field.kind !== "value" && !disabled && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Remove
          </button>
        ) : null}
      </div>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {field.kind === "value"
            ? "Element selector"
            : isRoot
              ? "Container selector"
              : "Selector inside parent"}
        </span>
        <input
          value={field.kind === "object" ? (field.selector ?? "") : field.selector}
          onChange={(event) => {
            const value = event.target.value;
            if (field.kind === "value") onChange({ ...field, selector: value });
            else if (field.kind === "list") onChange({ ...field, selector: value });
            else onChange({ ...field, selector: value || undefined });
          }}
          disabled={disabled}
          spellCheck={false}
          placeholder={field.kind === "list" ? "tbody tr" : ":scope > td:nth-child(1)"}
          className={`${inputClass} ${
            field.kind !== "object" && !field.selector.trim() ? "border-red-400 dark:border-red-700" : ""
          }`}
        />
      </label>

      {field.kind === "list" ? (
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          Up to {field.limit} items per run
        </p>
      ) : null}

      {children.length > 0 ? (
        <div className="mt-3 space-y-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
          {children.map((child, index) => (
            <FieldEditor
              key={`${child.key}-${index}`}
              field={child}
              disabled={disabled}
              onChange={(next) =>
                onChange({ ...field, fields: updateChild(children, index, next) } as ExtractField)
              }
              onRemove={() =>
                onChange({ ...field, fields: removeChild(children, index) } as ExtractField)
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ExtractionTreeEditor({ root, onChange, disabled = false }: Props) {
  const issues = validateStructuredField(root);

  return (
    <div className="space-y-2">
      {issues.length > 0 ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {issues[0]?.message}
          {issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}
        </p>
      ) : null}
      <FieldEditor field={root} onChange={onChange} isRoot disabled={disabled} />
    </div>
  );
}
