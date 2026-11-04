import { describe, expect, it } from "vitest";
import type { FillStep } from "./fields";
import {
  autoPayloadFields,
  createField,
  fieldsUsedBySteps,
  fillToCredential,
  fillToPayload,
  markFieldSecret,
  normalizeFieldKey,
  removeField,
  setFieldDefault,
  uniqueFieldKey,
} from "./fields";

function literalFill(overrides: Partial<FillStep> = {}): FillStep {
  return {
    id: "fill-email",
    type: "fill",
    enabled: true,
    optional: false,
    selectors: [{ kind: "css", value: "input[name=email]" }],
    value: { mode: "literal", text: "sam@example.com" },
    label: "Fill Email",
    ...overrides,
  } as FillStep;
}

describe("field keys", () => {
  it("normalizes labels into snake_case keys", () => {
    expect(normalizeFieldKey("Fill Email Address")).toBe("fill_email_address");
    expect(normalizeFieldKey("2nd password")).toBe("field_2nd_password");
    expect(normalizeFieldKey("!!!", "fallback")).toBe("fallback");
  });

  it("makes duplicate keys unique", () => {
    expect(uniqueFieldKey("email", ["email", "email_2"])).toBe("email_3");
  });
});

describe("fillToPayload", () => {
  it("adds a non-secret field and keeps the recorded value as a default", () => {
    const result = fillToPayload([], literalFill());
    expect(result.step.value).toEqual({ mode: "field", key: "fill_email" });
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({
      key: "fill_email",
      secret: false,
      required: false,
      defaultValue: "sam@example.com",
    });
  });

  it("leaves field-based fills unchanged", () => {
    const step = literalFill({ value: { mode: "field", key: "email" } });
    const fields = [
      { key: "email", label: "Email", type: "email" as const, secret: false, required: true },
    ];
    const result = fillToPayload(fields, step);
    expect(result.fields).toBe(fields);
    expect(result.step).toBe(step);
  });
});

describe("fillToCredential", () => {
  it("stores a secret field without a default value", () => {
    const result = fillToCredential([], literalFill());
    expect(result.fieldKey).toBe("fill_email");
    expect(result.step.value).toEqual({ mode: "field", key: "fill_email" });
    expect(result.fields[0]).toMatchObject({ key: "fill_email", secret: true });
    expect(result.fields[0]?.defaultValue).toBeUndefined();
  });

  it("marks an existing field secret and removes its default", () => {
    const fields = [
      {
        key: "password",
        label: "Password",
        type: "password" as const,
        secret: false,
        required: true,
        defaultValue: "hunter2",
      },
    ];
    const result = fillToCredential(fields, literalFill({ value: { mode: "field", key: "password" } }));
    expect(result.fields).toEqual(markFieldSecret(fields, "password"));
    expect(result.fields[0]?.secret).toBe(true);
    expect(result.fields[0]?.required).toBe(true);
    expect(result.fields[0]?.defaultValue).toBeUndefined();
  });
});

describe("autoPayloadFields", () => {
  it("turns recorded fills and uploads into payload fields", () => {
    const result = autoPayloadFields([], [
      literalFill(),
      {
        id: "upload",
        type: "upload",
        enabled: true,
        optional: false,
        selectors: [{ kind: "css", value: "input[type=file]" }],
        fieldKey: "resume",
        label: "Upload Resume",
      },
    ]);

    expect(result.fields).toEqual([
      expect.objectContaining({
        key: "fill_email",
        defaultValue: "sam@example.com",
        required: false,
      }),
      expect.objectContaining({ key: "resume", type: "file", required: true }),
    ]);
    expect(result.steps[0]).toMatchObject({ value: { mode: "field", key: "fill_email" } });
    expect(result.steps[1]).toMatchObject({ fieldKey: "resume" });
  });

  it("returns original arrays when no migration is needed", () => {
    const fields = [
      { key: "email", label: "Email", type: "email" as const, secret: false, required: true },
    ];
    const steps = [literalFill({ value: { mode: "field", key: "email" } })];
    const result = autoPayloadFields(fields, steps);
    expect(result.fields).toBe(fields);
    expect(result.steps).toBe(steps);
  });

  it("turns recorded selects and checkboxes into payload defaults", () => {
    const result = autoPayloadFields([], [
      {
        id: "select",
        type: "select",
        enabled: true,
        optional: false,
        selectors: [{ kind: "css", value: "select[name=country]" }],
        value: "US",
        label: "Select Country",
      },
      {
        id: "check",
        type: "check",
        enabled: true,
        optional: false,
        selectors: [{ kind: "css", value: "input[name=terms]" }],
        checked: true,
        label: "Check Terms",
      },
    ]);

    expect(result.fields).toEqual([
      expect.objectContaining({ key: "select_country", type: "select", defaultValue: "US" }),
      expect.objectContaining({ key: "check_terms", type: "checkbox", defaultValue: true }),
    ]);
    expect(result.steps[0]).toMatchObject({ value: { mode: "field", key: "select_country" } });
    expect(result.steps[1]).toMatchObject({ checked: { mode: "field", key: "check_terms" } });
  });

  it("reuses an existing field instead of creating a duplicate", () => {
    const fields = [
      {
        key: "fill_email",
        label: "Fill Email",
        type: "text" as const,
        secret: false,
        required: false,
        defaultValue: "sam@example.com",
      },
    ];
    const result = autoPayloadFields(fields, [literalFill()]);
    expect(result.fields).toBe(fields);
    expect(result.steps[0]).toMatchObject({ value: { mode: "field", key: "fill_email" } });
  });
});

describe("field helpers", () => {
  it("creates arbitrary payload and credential fields with unique keys", () => {
    const payload = createField([], { label: "Order ID", type: "text", defaultValue: "abc" });
    expect(payload.field).toMatchObject({
      key: "order_id",
      label: "Order ID",
      secret: false,
      required: false,
      defaultValue: "abc",
    });

    const credential = createField(payload.fields, {
      label: "API token",
      type: "password",
      secret: true,
      defaultValue: "ignored",
    });
    expect(credential.field).toMatchObject({
      key: "api_token",
      secret: true,
      required: true,
    });
    expect(credential.field.defaultValue).toBeUndefined();

    const duplicate = createField(credential.fields, { label: "Order ID", type: "text" });
    expect(duplicate.field.key).toBe("order_id_2");
    expect(removeField(duplicate.fields, "order_id")).toHaveLength(2);
  });

  it("sets defaults without touching other fields", () => {
    const fields = [
      { key: "a", label: "A", type: "text" as const, secret: false, required: true },
      { key: "b", label: "B", type: "text" as const, secret: false, required: true },
    ];
    const updated = setFieldDefault(fields, "a", "value");
    expect(updated[0]?.defaultValue).toBe("value");
    expect(updated[1]?.defaultValue).toBeUndefined();
  });

  it("reports fields referenced by steps", () => {
    const keys = fieldsUsedBySteps([
      literalFill({ value: { mode: "field", key: "email" } }),
      {
        id: "upload",
        type: "upload",
        enabled: true,
        optional: false,
        selectors: [{ kind: "css", value: "input[type=file]" }],
        fieldKey: "resume",
      },
    ]);
    expect(keys.sort()).toEqual(["email", "resume"]);
  });
});
