import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DefinitionError,
  parseDefinition,
  validateFieldReferences,
  type AutomationDefinition,
} from "./definition";

function loadExample(name: string): string {
  return readFileSync(new URL(`./examples/${name}`, import.meta.url), "utf8");
}

function minimalDefinition(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return parseDefinition({
    version: 1,
    startUrl: "https://example.com",
    fields: [],
    steps: [{ id: "goto", type: "goto", url: "https://example.com" }],
    settings: {},
    ...overrides,
  });
}

describe("parseDefinition", () => {
  it("parses all example definitions", () => {
    for (const name of ["example-extract.json", "example-login.json", "example-screenshot.json"]) {
      const definition = parseDefinition(loadExample(name));
      expect(definition.version).toBe(1);
      expect(definition.settings.stepTimeoutMs).toBe(15000);
      expect(definition.settings.runTimeoutMs).toBe(300000);
      expect(definition.settings.allowHumanHelp).toBe(true);
      expect(definition.steps.length).toBeGreaterThan(0);
    }
  });

  it("rejects empty selector lists", () => {
    expect(() =>
      parseDefinition({
        version: 1,
        startUrl: "https://example.com",
        steps: [{ id: "click", type: "click", selectors: [] }],
      }),
    ).toThrow(DefinitionError);

    try {
      parseDefinition({
        version: 1,
        startUrl: "https://example.com",
        steps: [{ id: "click", type: "click", selectors: [] }],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionError);
      expect((error as DefinitionError).issues.join("\n")).toContain("steps[0].selectors");
    }
  });

  it("reports readable JSON errors", () => {
    expect(() => parseDefinition("{not json")).toThrow(/Invalid JSON/);
  });
});

describe("validateFieldReferences", () => {
  it("detects a missing field reference", () => {
    const definition = minimalDefinition({
      steps: [
        { id: "goto", type: "goto", url: "https://example.com", enabled: true, optional: false },
        {
          id: "fill-missing",
          type: "fill",
          enabled: true,
          optional: false,
          selectors: [{ kind: "css", value: "input" }],
          value: { mode: "field", key: "does_not_exist" },
        },
      ],
    });

    const issues = validateFieldReferences(definition);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.stepId).toBe("fill-missing");
    expect(issues[0]?.message).toContain("does_not_exist");
  });

  it("accepts existing field references", () => {
    const definition = parseDefinition(loadExample("example-login.json"));
    expect(validateFieldReferences(definition)).toEqual([]);
  });
});

describe("extractStructured", () => {
  function structuredDefinition(root: unknown) {
    return {
      version: 1,
      startUrl: "https://example.com",
      steps: [
        {
          id: "structured",
          type: "extractStructured",
          selectors: [{ kind: "css", value: "#results" }],
          root,
        },
      ],
    };
  }

  it("parses nested objects and lists", () => {
    const definition = parseDefinition(
      structuredDefinition({
        kind: "object",
        key: "page",
        fields: [
          {
            kind: "list",
            key: "products",
            selector: "tbody tr",
            fields: [
              { kind: "value", key: "name", selector: ":scope > td:nth-child(1)" },
              { kind: "value", key: "price", selector: ":scope > td:nth-child(2)" },
            ],
          },
        ],
      }),
    );

    const step = definition.steps[0];
    expect(step?.type).toBe("extractStructured");
    if (step?.type !== "extractStructured") return;
    expect(step.root.kind).toBe("object");
    if (step.root.kind !== "object") return;
    expect(step.root.fields[0]?.kind).toBe("list");
    if (step.root.fields[0]?.kind !== "list") return;
    expect(step.root.fields[0].fields).toHaveLength(2);
  });

  it("rejects duplicate output keys across steps", () => {
    expect(() =>
      parseDefinition({
        version: 1,
        startUrl: "https://example.com",
        steps: [
          {
            id: "one",
            type: "extract",
            selectors: [{ kind: "css", value: "h1" }],
            outputKey: "title",
          },
          {
            id: "two",
            type: "extractStructured",
            selectors: [{ kind: "css", value: "main" }],
            root: { kind: "value", key: "title", selector: ":scope", attribute: "text" },
          },
        ],
      }),
    ).toThrow(/Duplicate output key/);
  });

  it("rejects duplicate keys inside one object", () => {
    expect(() =>
      parseDefinition(
        structuredDefinition({
          kind: "object",
          key: "page",
          fields: [
            { kind: "value", key: "name", selector: ":scope > h1" },
            { kind: "value", key: "name", selector: ":scope > h2" },
          ],
        }),
      ),
    ).toThrow(/Duplicate output field key/);
  });
});
