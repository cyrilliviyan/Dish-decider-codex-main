import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type VegPref = "veg" | "non_veg" | "mixed";
type SpicePref = "mild" | "medium" | "hot";

type MenuItem = {
  id: string;
  hotel_id: string;
  name: string;
  category: "starter" | "main" | "bread" | "rice" | "dessert" | "drink";
  price: number;
  veg_flag: boolean;
  spice_level: SpicePref;
  serves_count: number;
  must_try: boolean;
  is_available: boolean;
};

type RequestBody = {
  hotel_id: string;
  party_size: number;
  budget: number;
  veg_pref: VegPref;
  spice_pref: SpicePref;
  allergies?: string;
};

type SuggestedItem = {
  item_id: string;
  name: string;
  category: MenuItem["category"];
  quantity: number;
  unit_price: number;
  line_total: number;
  reason: string;
};

type Suggestion = {
  starters: SuggestedItem[];
  mains: SuggestedItem[];
  total_price: number;
  summary: string;
  source?: "claude" | "fallback";
  order_id?: string;
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
    const body = (await request.json()) as RequestBody;
    validateRequest(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase function environment is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: menu, error: menuError } = await supabase
      .from("menu_items")
      .select("*")
      .eq("hotel_id", body.hotel_id)
      .eq("is_available", true);

    if (menuError) throw new Error(menuError.message);
    if (!menu?.length) throw new Error("No available menu items found for this hotel.");

    const items = menu.map((item) => ({ ...item, price: Number(item.price) })) as MenuItem[];
    let suggestion: Suggestion | null = null;

    if (anthropicApiKey) {
      suggestion = await suggestWithClaude(anthropicApiKey, items, body);
      if (!suggestion) {
        suggestion = await suggestWithClaude(anthropicApiKey, items, body, true);
      }
    }

    if (!suggestion) {
      suggestion = fallbackSuggestion(items, body);
      suggestion.source = "fallback";
    } else {
      suggestion.source = "claude";
    }

    const finalSuggestion = normalizeSuggestion(suggestion, items, body);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        hotel_id: body.hotel_id,
        party_size: body.party_size,
        budget: body.budget,
        veg_pref: body.veg_pref,
        spice_pref: body.spice_pref,
        allergies: body.allergies ?? "",
        ai_suggested_items: [...finalSuggestion.starters, ...finalSuggestion.mains],
        final_items: [],
        total_price: finalSuggestion.total_price,
        status: "pending"
      })
      .select("id")
      .single();

    if (orderError) throw new Error(orderError.message);

    return json({ ...finalSuggestion, order_id: order.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

function validateRequest(body: RequestBody) {
  if (!body.hotel_id) throw new Error("hotel_id is required.");
  if (!Number.isFinite(body.party_size) || body.party_size < 1) throw new Error("party_size must be at least 1.");
  if (!Number.isFinite(body.budget) || body.budget < 1) throw new Error("budget must be positive.");
  if (!["veg", "non_veg", "mixed"].includes(body.veg_pref)) throw new Error("Invalid veg_pref.");
  if (!["mild", "medium", "hot"].includes(body.spice_pref)) throw new Error("Invalid spice_pref.");
}

async function suggestWithClaude(
  apiKey: string,
  menu: MenuItem[],
  body: RequestBody,
  corrective = false
): Promise<Suggestion | null> {
  const prompt = {
    party_size: body.party_size,
    budget: body.budget,
    veg_pref: body.veg_pref,
    spice_pref: body.spice_pref,
    allergies: body.allergies || "none",
    menu: menu.map(({ id, name, category, price, veg_flag, spice_level, serves_count, must_try }) => ({
      id,
      name,
      category,
      price,
      veg_flag,
      spice_level,
      serves_count,
      must_try
    }))
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-20241022",
      max_tokens: 1600,
      temperature: corrective ? 0 : 0.2,
      system: [
        "You create restaurant combo suggestions.",
        "Recommend only real item_ids from the provided menu.",
        "Respect the user's total budget with about 10 percent tolerance.",
        "Use serves_count to size quantities for party_size.",
        "Prioritize must_try items when they fit the preferences and budget.",
        "Respect veg_pref, spice_pref, and allergies.",
        "Return only strict JSON with keys: starters, mains, total_price, summary.",
        "Each item must have item_id, quantity, and reason. Do not include markdown."
      ].join(" "),
      messages: [
        {
          role: "user",
          content: corrective
            ? `Previous response was invalid. Try again with strict JSON and only menu item ids. Input: ${JSON.stringify(prompt)}`
            : JSON.stringify(prompt)
        }
      ]
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = data?.content?.find((part: { type: string }) => part.type === "text")?.text;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as Suggestion;
    return validateClaudeSuggestion(parsed, menu, body) ? parsed : null;
  } catch {
    return null;
  }
}

function validateClaudeSuggestion(suggestion: Suggestion, menu: MenuItem[], body: RequestBody) {
  const menuById = new Map(menu.map((item) => [item.id, item]));
  const allItems = [...(suggestion.starters ?? []), ...(suggestion.mains ?? [])];
  if (!allItems.length) return false;

  for (const item of allItems) {
    const menuItem = menuById.get(item.item_id);
    if (!menuItem || !Number.isFinite(item.quantity) || item.quantity < 1) return false;
    if (body.veg_pref === "veg" && !menuItem.veg_flag) return false;
    if (body.veg_pref === "non_veg" && menuItem.veg_flag && allItems.length === 1) return false;
  }

  const total = allItems.reduce((sum, item) => {
    const menuItem = menuById.get(item.item_id)!;
    return sum + menuItem.price * item.quantity;
  }, 0);

  return total <= body.budget * 1.1;
}

function normalizeSuggestion(suggestion: Suggestion, menu: MenuItem[], body: RequestBody): Suggestion {
  const menuById = new Map(menu.map((item) => [item.id, item]));
  const normalize = (item: SuggestedItem): SuggestedItem => {
    const menuItem = menuById.get(item.item_id);
    if (!menuItem) throw new Error(`Invalid menu item ${item.item_id}`);
    const quantity = Math.max(1, Math.ceil(Number(item.quantity) || 1));
    return {
      item_id: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      quantity,
      unit_price: menuItem.price,
      line_total: menuItem.price * quantity,
      reason: item.reason || reasonFor(menuItem, body)
    };
  };

  const starters = (suggestion.starters ?? []).map(normalize);
  const mains = (suggestion.mains ?? []).map(normalize);
  const total = [...starters, ...mains].reduce((sum, item) => sum + item.line_total, 0);

  return {
    starters,
    mains,
    total_price: total,
    summary: suggestion.summary || `Sized for ${body.party_size} guests within a ${body.budget} budget.`,
    source: suggestion.source
  };
}

function fallbackSuggestion(menu: MenuItem[], body: RequestBody): Suggestion {
  const preferred = menu
    .filter((item) => body.veg_pref !== "veg" || item.veg_flag)
    .filter((item) => body.spice_pref === "hot" || item.spice_level !== "hot")
    .sort((a, b) => Number(b.must_try) - Number(a.must_try) || a.price - b.price);

  const starters = pickItems(preferred.filter((item) => item.category === "starter"), body, body.budget * 0.35);
  const mains = pickItems(
    preferred.filter((item) => ["main", "rice", "bread"].includes(item.category)),
    body,
    body.budget - totalFor(starters)
  );

  const normalized = [...starters, ...mains].map(({ item, quantity }) => ({
    item_id: item.id,
    name: item.name,
    category: item.category,
    quantity,
    unit_price: item.price,
    line_total: item.price * quantity,
    reason: reasonFor(item, body)
  }));

  return {
    starters: normalized.filter((item) => item.category === "starter"),
    mains: normalized.filter((item) => item.category !== "starter"),
    total_price: normalized.reduce((sum, item) => sum + item.line_total, 0),
    summary: "We built this combo from available menu items using party size, budget, and preference rules."
  };
}

function pickItems(items: MenuItem[], body: RequestBody, budget: number) {
  const picked: Array<{ item: MenuItem; quantity: number }> = [];
  let remaining = budget;

  for (const item of items) {
    const quantity = Math.max(1, Math.ceil(body.party_size / Math.max(1, item.serves_count)));
    const lineTotal = quantity * item.price;
    if (lineTotal <= remaining * 1.1) {
      picked.push({ item, quantity });
      remaining -= lineTotal;
    }
    if (picked.length >= 2) break;
  }

  if (!picked.length && items[0]) {
    picked.push({ item: items[0], quantity: 1 });
  }

  return picked;
}

function totalFor(items: Array<{ item: MenuItem; quantity: number }>) {
  return items.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
}

function reasonFor(item: MenuItem, body: RequestBody) {
  const mustTry = item.must_try ? "Must-try pick" : "Good fit";
  return `${mustTry}; ${item.spice_level} spice and serves about ${item.serves_count}, sized for ${body.party_size}.`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
}
