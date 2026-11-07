import type { ExtractApiStep } from "@shared/definition";
import { shapeApiBody } from "@shared/api-extract";
import { buildOutputMeta, buildPlan, normalizeWithPlan } from "@shared/normalize";
import { resolveLocator } from "./selectors";
import { extractStructured } from "./structured";
import type { StepContext } from "./types";

async function replayRequest(step: ExtractApiStep, ctx: StepContext): Promise<unknown> {
  const headers: Record<string, string> = {};
  for (const header of step.request.headers) headers[header.name] = header.value;
  if (step.request.body && step.request.bodyType === "json" && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  try {
    return await ctx.page.evaluate(
      async (request: { url: string; method: string; headers: Record<string, string>; body?: string }) => {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          credentials: "include",
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text;
        }
      },
      {
        url: step.request.url,
        method: step.request.method,
        headers,
        body: step.request.body,
      },
    );
  } catch {
    const response = await ctx.page.context().request.fetch(step.request.url, {
      method: step.request.method,
      headers,
      data: step.request.body,
      failOnStatusCode: false,
    });
    if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}

async function mergeDomFields(step: ExtractApiStep, rows: unknown, ctx: StepContext): Promise<unknown> {
  if (!Array.isArray(rows) || !step.container || !step.fallback || step.fallback.kind !== "list") return rows;
  const domFields = step.fields.filter((field) => field.source === "dom");
  if (domFields.length === 0) return rows;

  try {
    const { locator } = await resolveLocator(ctx.page, step.container, ctx.timeout, () => undefined, step.id);
    const rowLocator = locator.locator(step.fallback.selector);
    const count = await rowLocator.count();
    for (let index = 0; index < rows.length; index += 1) {
      if (index >= count) break;
      const row = rowLocator.nth(index);
      const record =
        rows[index] && typeof rows[index] === "object" ? (rows[index] as Record<string, unknown>) : {};
      for (const field of domFields) {
        if (!field.domSelector) continue;
        const cell = row.locator(field.domSelector).first();
        const text = await cell.innerText({ timeout: 2000 }).catch(() => "");
        if (text.trim() !== "") record[field.key] = text.replace(/\s+/g, " ").trim();
      }
      rows[index] = record;
    }
  } catch {
    // DOM enrichment is best-effort; API data is still returned.
  }
  return rows;
}

export async function runApiExtract(step: ExtractApiStep, ctx: StepContext): Promise<unknown> {
  const since = ctx.networkCursor ?? 0;
  const isGet = step.request.method === "GET";
  const grace = isGet ? 3000 : 8000;
  let body: unknown;
  let usedPassive = false;

  let entry = since > 0
    ? await ctx.network?.waitForApiMatch(step.match, since, Math.min(ctx.timeout, grace))
    : null;

  if (!entry) {
    try {
      body = await replayRequest(step, ctx);
    } catch {
      body = undefined;
    }
  }

  if (since > 0) {
    const late = ctx.network?.findApiMatch(step.match, since, false);
    if (late && late.body !== undefined) entry = late;
  }

  if (body === undefined) {
    entry =
      ctx.network?.findApiMatch(step.match, since, false) ??
      ctx.network?.findApiMatch(step.match, 0, false) ??
      (await ctx.network?.waitForApiMatch(step.match, since, Math.min(ctx.timeout, 5000))) ??
      null;
  }

  if (entry && entry.body !== undefined) {
    body = entry.body;
    usedPassive = true;
  }

  if (body === undefined) {
    try {
      body = await replayRequest(step, ctx);
    } catch {
      body = undefined;
    }
  }

  if (body === undefined && step.fallback && step.container) {
    try {
      const { locator } = await resolveLocator(ctx.page, step.container, ctx.timeout, () => undefined, step.id);
      const fallbackValue = await extractStructured(locator, step.fallback);
      return finalize(step, fallbackValue, ctx, "html", " (DOM fallback)");
    } catch {
      // Fall through to the API error below.
    }
  }

  if (body === undefined) {
    throw new Error(`Could not load API response ${step.request.method} ${step.request.url}`);
  }

  const shaped = shapeApiBody(body, step);
  const merged = await mergeDomFields(step, shaped, ctx);
  await ctx.log(
    "info",
    `API ${step.request.method} ${step.match.pathname} -> "${step.outputKey}"${usedPassive ? " (observed)" : " (replayed)"}`,
    step.id,
  );
  return finalize(step, merged, ctx, "api", "");
}

/** Normalizes the response with the record-time plan and records output metadata. */
function finalize(
  step: ExtractApiStep,
  value: unknown,
  ctx: StepContext,
  source: "api" | "html",
  suffix: string,
): unknown {
  const plan = step.outputSchema ?? buildPlan(value, { key: step.outputKey });
  const normalized = normalizeWithPlan(value, plan);
  ctx.meta[step.outputKey] = buildOutputMeta(normalized, plan, source, {
    endpoint: step.request.url,
    method: step.request.method,
  });
  void ctx.log(
    "info",
    `Normalized "${step.outputKey}" with ${plan.fields.length} canonical field(s)${suffix}`,
    step.id,
  );
  return normalized;
}