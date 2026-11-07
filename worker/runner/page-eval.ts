import type { Frame, Locator, Page } from "playwright";

type PageWithKeepNames = { __name?: (fn: unknown, name?: string) => unknown };
type Evaluator = { evaluate: (fn: () => void) => Promise<unknown> };

/**
 * tsx/esbuild compiles with `keepNames`, which wraps every named nested
 * function in a `__name(...)` call. Those helpers do not exist in the page, so
 * a serialized function that declares nested functions throws. Defining a
 * no-op `__name` in the page before evaluating such a function makes it work.
 */
export async function patchKeepNames(target: Page | Frame | Locator): Promise<void> {
  await (target as unknown as Evaluator)
    .evaluate(() => {
      const scope = window as unknown as PageWithKeepNames;
      scope.__name ??= (fn) => fn;
    })
    .catch(() => undefined);
}
