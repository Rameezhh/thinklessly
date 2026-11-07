import { NextResponse } from "next/server";

const CATEGORIES = ["Home", "Tools", "Garden", "Office"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("count") ?? "3");
  const count = Number.isFinite(requested) ? Math.min(20, Math.max(1, Math.floor(requested))) : 3;
  const renamed = url.searchParams.get("variant") === "renamed";

  const products = Array.from({ length: count }, (_, index) => {
    if (renamed) {
      return {
        product_title: `Product ${index + 1}`,
        price_value: 10 + index * 3,
        category_name: CATEGORIES[index % CATEGORIES.length],
      };
    }
    return {
      id: index + 1,
      title: `Product ${index + 1}`,
      price: 10 + index * 3,
      category: CATEGORIES[index % CATEGORIES.length],
    };
  });

  return NextResponse.json(
    { data: { products } },
    { headers: { "Cache-Control": "no-store" } },
  );
}