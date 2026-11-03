import { z } from "zod";

export const recipeIdSchema = z.enum(["scrape", "table", "links", "images", "if_else", "login"]);
export type RecipeId = z.infer<typeof recipeIdSchema>;

export type RecipeMode = "auto" | "single" | "list" | "fields";

export type Recipe = {
  id: RecipeId;
  title: string;
  description: string;
  outcome: string;
  defaultName: string;
  goal: string;
  mode: RecipeMode;
  branch: boolean;
};

export const RECIPES: Recipe[] = [
  {
    id: "scrape",
    title: "Scrape page data",
    description: "Point at a section and capture it as live JSON.",
    outcome: "Good for product details, cards, profiles, or any repeated block.",
    defaultName: "Scrape page data",
    goal: "Select a page section and capture its data as JSON.",
    mode: "auto",
    branch: false,
  },
  {
    id: "table",
    title: "Get table data",
    description: "Turn an HTML table into a clean list of rows.",
    outcome: "Column headers become JSON keys and rows are read again on every run.",
    defaultName: "Scrape table",
    goal: "Click a table to capture every row as JSON.",
    mode: "auto",
    branch: false,
  },
  {
    id: "links",
    title: "Collect links",
    description: "Capture link text and href values from a region.",
    outcome: "Useful for directories, navigation, feeds, and search results.",
    defaultName: "Collect links",
    goal: "Select a group of links or a section that contains them.",
    mode: "auto",
    branch: false,
  },
  {
    id: "images",
    title: "Collect images",
    description: "Capture image sources and alt text.",
    outcome: "Useful for galleries, catalogs, and media monitoring.",
    defaultName: "Collect images",
    goal: "Select an image or a section containing images.",
    mode: "auto",
    branch: false,
  },
  {
    id: "if_else",
    title: "Conditional flow",
    description: "Record a flow that branches on page content.",
    outcome: "Choose a page value, then record the true and false paths.",
    defaultName: "Conditional automation",
    goal: "Record both paths, then add an if / else condition in the toolbar.",
    mode: "auto",
    branch: true,
  },
  {
    id: "login",
    title: "Login flow",
    description: "Record a sign-in and store the password as a credential.",
    outcome: "The password is encrypted and is never placed in API payloads.",
    defaultName: "Login to my account",
    goal: "Record the sign-in form. Use Add to credential for the password.",
    mode: "single",
    branch: false,
  },
];

export function getRecipe(value: string | string[] | undefined): Recipe | null {
  const id = Array.isArray(value) ? value[0] : value;
  const parsed = recipeIdSchema.safeParse(id);
  if (!parsed.success) return null;
  return RECIPES.find((recipe) => recipe.id === parsed.data) ?? null;
}
