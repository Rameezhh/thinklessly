import { normalizeKey } from "../api-values";

/**
 * Maps the many names real APIs use to one canonical concept key. This is the
 * deterministic half of output normalization: no network calls, no model, no
 * API key, and the same mapping at record time and run time.
 */
const SYNONYMS: Record<string, string[]> = {
  id: ["identifier", "uid", "uuid", "guid", "pk", "product_id", "item_id", "listing_id", "object_id", "objectid", "record_id"],
  title: ["name", "product_name", "item_name", "listing_name", "display_name", "label", "heading", "subject", "ttl", "nm", "product_title"],
  description: ["desc", "summary", "details", "body", "content", "product_description", "item_description", "overview"],
  price: ["prc", "cost", "unit_price", "sale_price", "current_price", "list_price", "price_value", "regular_price", "final_price"],
  currency: ["currency_code", "curr", "ccy", "price_currency"],
  discount: ["discount_amount", "savings", "markdown", "sale_discount", "discount_value"],
  rating: ["stars", "star_rating", "average_rating", "avg_rating", "score"],
  review_count: ["reviews", "reviewcount", "num_reviews", "ratings_count", "total_reviews", "review_total"],
  image_url: ["image", "imageurl", "img", "img_url", "thumbnail", "thumbnail_url", "photo", "picture", "main_image", "cover_image"],
  images: ["image_urls", "photos", "pictures", "gallery", "image_list"],
  url: ["link", "href", "product_url", "producturl", "permalink", "web_url", "page_url", "detail_url"],
  brand: ["brand_name", "manufacturer", "maker", "vendor_name"],
  category: ["category_name", "department", "product_type", "category_path", "breadcrumb"],
  sku: ["sku_id", "skuid", "product_code", "item_code", "part_number", "mpn", "model"],
  asin: ["asin_id", "amazon_id"],
  in_stock: ["instock", "stock", "availability", "available", "is_available", "stock_status", "inventory",
    "stock_level", "is_in_stock", "purchasable"],
  seller: ["seller_name", "vendor", "merchant", "store", "shop", "seller_id", "sold_by"],
  shipping: ["shipping_price", "delivery", "delivery_price", "shipping_cost", "shipping_fee"],
  quantity: ["qty", "units", "item_count", "num_items"],
  total: ["total_price", "grand_total", "order_total", "amount_due", "subtotal", "sub_total"],
  color: ["colour", "color_name"],
  size: ["dimensions", "size_name"],
  weight: ["weight_value", "item_weight"],
  location: ["city", "place", "address", "region", "country", "area"],
  author: ["author_name", "creator", "writer", "by", "posted_by"],
  created_at: ["createdat", "created", "creation_date", "create_time", "date_created", "timestamp"],
  updated_at: ["updatedat", "updated", "modified", "modification_date", "last_updated", "last_modified"],
  published_at: ["publishedat", "published", "publish_date", "publication_date", "pub_date", "release_date"],
  email: ["email_address", "mail", "contact_email"],
  phone: ["phone_number", "telephone", "mobile", "tel", "contact_phone"],
  tags: ["keywords", "tag_list", "topics"],
  status: ["state", "order_status", "run_status", "availability_status"],
  customer: ["customer_name", "buyer", "buyer_name", "client", "client_name"],
  body: ["review_text", "comment", "message", "text", "note", "full_text"],
  role: ["user_role", "account_type", "permission"],
  avatar_url: ["avatar", "profile_image", "profile_picture", "profile_photo"],
  upc: ["upc_code", "barcode"],
  isbn: ["isbn_10", "isbn_13"],
  verified: ["is_verified", "verified_purchase"],
};

const LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  for (const alias of [canonical, ...aliases]) LOOKUP.set(normalizeKey(alias), canonical);
}

/** Canonical snake_case key for any raw response key. Falls back to normalizeKey. */
export function canonicalKey(raw: string): string {
  const normalized = normalizeKey(raw);
  return LOOKUP.get(normalized) ?? normalized;
}

export function aliasesFor(canonical: string): string[] {
  return SYNONYMS[canonical] ?? [];
}

export function canonicalKeys(): string[] {
  return Object.keys(SYNONYMS);
}

const PRICE_KEYS = new Set([
  "price", "discount", "shipping", "total", "subtotal", "cost", "fee", "tax",
]);
const DATE_KEYS = new Set(["created_at", "updated_at", "published_at", "date", "started_at", "finished_at"]);
const BOOLEAN_KEYS = new Set(["in_stock", "verified", "available", "active", "enabled", "is_available"]);
const URL_KEYS = new Set(["url", "image_url", "avatar_url", "link", "href"]);
const STRING_KEYS = new Set(["id", "sku", "asin", "upc", "isbn", "phone", "zip", "postal_code", "currency", "status", "role"]);

export function isPriceKey(key: string): boolean {
  return PRICE_KEYS.has(canonicalKey(key));
}

export function isDateKey(key: string): boolean {
  return DATE_KEYS.has(canonicalKey(key));
}

export function isBooleanKey(key: string): boolean {
  return BOOLEAN_KEYS.has(canonicalKey(key));
}

export function isUrlKey(key: string): boolean {
  return URL_KEYS.has(canonicalKey(key));
}

export function isStringKey(key: string): boolean {
  return STRING_KEYS.has(canonicalKey(key));
}

export type EntityTemplate = {
  name: string;
  required: string[];
  fields: string[];
};

export const ENTITY_TEMPLATES: EntityTemplate[] = [
  {
    name: "product",
    required: ["title", "price"],
    fields: ["id", "sku", "asin", "brand", "category", "description", "rating", "review_count",
      "currency", "image_url", "images", "url", "in_stock", "quantity", "seller", "shipping",
      "color", "size", "weight", "tags"],
  },
  {
    name: "order",
    required: ["id", "total"],
    fields: ["status", "currency", "created_at", "customer", "email", "shipping", "quantity", "url"],
  },
  {
    name: "review",
    required: ["rating"],
    fields: ["id", "title", "body", "author", "created_at", "url", "verified"],
  },
  {
    name: "user",
    required: ["id", "title"],
    fields: ["email", "phone", "role", "avatar_url", "created_at", "location", "url"],
  },
  {
    name: "article",
    required: ["title"],
    fields: ["id", "body", "description", "author", "url", "image_url", "published_at",
      "updated_at", "tags"],
  },
  {
    name: "listing",
    required: ["title"],
    fields: ["id", "price", "currency", "url", "image_url", "location", "created_at",
      "category", "description", "quantity", "status"],
  },
];

/** Scores canonical keys against known entity shapes and returns the best match. */
export function detectEntity(keys: Iterable<string>): string | undefined {
  const present = new Set(keys);
  let best: { name: string; score: number } | undefined;

  for (const template of ENTITY_TEMPLATES) {
    let score = 0;
    for (const field of template.fields) if (present.has(field)) score += 1;
    for (const field of template.required) if (present.has(field)) score += 3;
    const requiredMet = template.required.every((field) => present.has(field));
    if (requiredMet && template.required.length > 0) score += 3;
    if (!best || score > best.score) best = { name: template.name, score };
  }

  return best && best.score >= 4 ? best.name : undefined;
}

export function templateFor(entity: string | undefined): EntityTemplate | undefined {
  return ENTITY_TEMPLATES.find((template) => template.name === entity);
}
