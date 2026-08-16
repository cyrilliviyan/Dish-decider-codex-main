import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type MenuCategory = "starter" | "main" | "bread" | "rice" | "dessert" | "drink";
type SpicePreference = "mild" | "medium" | "hot";

type ParsedMenuItem = {
  name: string;
  category: MenuCategory;
  price: number;
  vegFlag: boolean;
  spiceLevel: SpicePreference;
  servesCount: number;
  mustTry: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const menuText = String(body.menu_text || "").trim();
    if (!menuText) throw new Error("menu_text is required.");

    const items = (await parseWithClaude(menuText)) ?? parseWithRules(menuText);
    return json({ items: items.map(normalizeItem).filter(Boolean) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

async function parseWithClaude(menuText: string): Promise<ParsedMenuItem[] | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-20241022",
      max_tokens: 1800,
      temperature: 0,
      system: [
        "Extract restaurant menu items from pasted text.",
        "Return only strict JSON with key items.",
        "Each item needs name, category, price, vegFlag, spiceLevel, servesCount, mustTry.",
        "category must be starter, main, bread, rice, dessert, or drink.",
        "spiceLevel must be mild, medium, or hot.",
        "Use reasonable defaults when the menu omits fields."
      ].join(" "),
      messages: [{ role: "user", content: menuText }]
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = data?.content?.find((part: { type: string }) => part.type === "text")?.text;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

function parseWithRules(menuText: string): ParsedMenuItem[] {
  return menuText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const price = Number(line.match(/(?:rs\.?|inr)?\s*(\d{2,5})/i)?.[1] ?? 0);
      const lower = line.toLowerCase();
      const name = line
        .replace(/(?:rs\.?|inr)?\s*\d{2,5}.*/i, "")
        .replace(/[-|,]+$/g, "")
        .trim();

      return {
        name,
        category: inferCategory(lower),
        price,
        vegFlag: !/(chicken|mutton|fish|prawn|egg|non[-\s]?veg)/i.test(line),
        spiceLevel: lower.includes("hot") || lower.includes("spicy") ? "hot" : lower.includes("mild") ? "mild" : "medium",
        servesCount: Number(line.match(/serves?\s*(\d+)/i)?.[1] ?? 2),
        mustTry: /must\s*try|chef|special/i.test(line)
      };
    })
    .filter((item) => item.name && item.price > 0);
}

function normalizeItem(item: ParsedMenuItem): ParsedMenuItem | null {
  if (!item?.name || !Number.isFinite(Number(item.price))) return null;
  return {
    name: String(item.name).trim(),
    category: ["starter", "main", "bread", "rice", "dessert", "drink"].includes(item.category) ? item.category : "main",
    price: Number(item.price),
    vegFlag: Boolean(item.vegFlag),
    spiceLevel: ["mild", "medium", "hot"].includes(item.spiceLevel) ? item.spiceLevel : "medium",
    servesCount: Math.max(1, Number(item.servesCount) || 2),
    mustTry: Boolean(item.mustTry)
  };
}

function inferCategory(text: string): MenuCategory {
  if (/starter|tikka|kebab|fry|65/.test(text)) return "starter";
  if (/naan|roti|paratha|bread/.test(text)) return "bread";
  if (/rice|biryani|pulao/.test(text)) return "rice";
  if (/dessert|ice cream|gulab|sweet/.test(text)) return "dessert";
  if (/drink|juice|lassi|tea|coffee|soda/.test(text)) return "drink";
  return "main";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
}
