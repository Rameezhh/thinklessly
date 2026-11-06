"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import type { Field } from "@shared/definition";
import { addFieldAction, type FieldPanelState } from "@/lib/automation-field-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, Select } from "@/components/ui/input";

const initialState: FieldPanelState = {};

const fieldTypes: Field["type"][] = ["text", "email", "number", "password", "select", "checkbox", "file"];

export function FieldAddForm({
  automationId,
  kind,
}: {
  automationId: string;
  kind: "payload" | "credential";
}) {
  const [state, formAction, pending] = useActionState(
    addFieldAction.bind(null, automationId, kind),
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Field["type"]>(kind === "credential" ? "password" : "text");
  const id = useId();
  const secret = kind === "credential";

  if (!open) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          {secret ? "Add credential field" : "Add payload field"}
        </Button>
        {state.success ? (
          <p className="text-xs font-medium text-[#0B6B43]">{state.success}</p>
        ) : null}
        {state.error ? (
          <p className="text-xs font-medium text-[#B42318]">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="animate-fade space-y-3 rounded-2xl border border-[#E5E4DE] bg-[#FBFBF9] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="mono text-[11px] uppercase tracking-[0.12em] text-[#5C6070]">
          {secret ? "New credential field" : "New payload field"}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-[#8A8E9E] transition-colors hover:bg-[#EFEEE8] hover:text-[#14151A]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-label`}>Label</Label>
          <Input id={`${id}-label`} name="label" required maxLength={80} placeholder="Order ID" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-key`}>Key (optional)</Label>
          <Input
            id={`${id}-key`}
            name="key"
            maxLength={60}
            placeholder="order_id"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`}>Type</Label>
          <Select
            id={`${id}-type`}
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as Field["type"])}
          >
            {fieldTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
        {!secret && type !== "file" && type !== "checkbox" ? (
          <div className="space-y-1">
            <Label htmlFor={`${id}-default`}>Default value</Label>
            <Input
              id={`${id}-default`}
              name="defaultValue"
              type={type === "number" ? "number" : "text"}
              placeholder="Used when no value is supplied"
            />
          </div>
        ) : null}
      </div>

      {!secret ? (
        <label className="flex items-center gap-2 text-xs text-[#5C6070]">
          <Checkbox name="required" />
          Required when no default is available
        </label>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor={`${id}-description`}>Description (optional)</Label>
        <Input id={`${id}-description`} name="description" maxLength={300} placeholder="Shown under the input" />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-3 py-2 text-xs text-[#B42318]">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Adding..." : "Add field"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
