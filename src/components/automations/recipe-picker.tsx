import Link from "next/link";
import { RECIPES, type RecipeId } from "@shared/recipes";

export function RecipePicker({ selectedId }: { selectedId?: RecipeId }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Start from a recipe</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Pick a goal. The recorder opens with the right mode and guidance, and everything remains editable.
          </p>
        </div>
        <Link
          href="/dashboard/automations/create"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Start blank
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RECIPES.map((recipe) => {
          const selected = recipe.id === selectedId;
          return (
            <Link
              key={recipe.id}
              href={`/dashboard/automations/create?recipe=${recipe.id}`}
              className={`group flex flex-col rounded-xl border p-4 shadow-sm transition-colors ${
                selected
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              }`}
            >
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{recipe.title}</span>
              <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{recipe.description}</span>
              <span className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                {recipe.outcome}
              </span>
              <span className="mt-4 text-xs font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                Use recipe
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
