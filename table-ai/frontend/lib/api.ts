import { supabase } from "@/lib/supabase";
import type { Hotel, HotelFormValues, MenuItem, MenuItemFormValues, OrderFormValues, ParsedMenuItem, Suggestion } from "@/lib/types";

export async function fetchHotel(hotelId: string): Promise<Hotel | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.from("hotels").select("*").eq("id", hotelId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMenu(hotelId: string): Promise<MenuItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("is_available", true)
    .order("category", { ascending: true })
    .order("must_try", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAllMenu(hotelId: string): Promise<MenuItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveHotel(values: HotelFormValues): Promise<Hotel> {
  if (!supabase) throw new Error("Supabase environment variables are not configured.");

  const payload = {
    id: values.id || undefined,
    name: values.name,
    location: values.location,
    owner_name: values.ownerName,
    mobile_number: values.mobileNumber,
    email: values.email,
    owner_pin: values.ownerPin,

  };

  const { data, error } = await supabase.from("hotels").upsert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function loginHotelOwner(email: string, ownerPin: string): Promise<Hotel> {
  if (!supabase) throw new Error("Supabase environment variables are not configured.");

  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("email", email.trim())
    .eq("owner_pin", ownerPin.trim())
    .single();

  if (error) throw new Error("Hotel login failed. Check email and PIN.");
  return data;
}

export async function saveMenuItem(values: MenuItemFormValues): Promise<MenuItem> {
  if (!supabase) throw new Error("Supabase environment variables are not configured.");

  const payload = {
    hotel_id: values.hotelId,
    name: values.name,
    category: values.category,
    price: values.price,
    veg_flag: values.vegFlag,
    spice_level: values.spiceLevel,
    serves_count: values.servesCount,
    must_try: values.mustTry,
    is_available: values.isAvailable
  };

  const query = values.id
    ? supabase.from("menu_items").update(payload).eq("id", values.id).select("*").single()
    : supabase.from("menu_items").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMenuAvailability(itemId: string, isAvailable: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase environment variables are not configured.");

  const { error } = await supabase.from("menu_items").update({ is_available: isAvailable }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function parseMenuText(menuText: string): Promise<ParsedMenuItem[]> {
  if (!supabase) throw new Error("Supabase environment variables are not configured.");

  const { data, error } = await supabase.functions.invoke<{ items: ParsedMenuItem[] }>("parse-menu", {
    body: { menu_text: menuText }
  });

  if (error) throw new Error(error.message);
  return data?.items ?? [];
}

export async function requestSuggestion(values: OrderFormValues): Promise<Suggestion> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase.functions.invoke<Suggestion>("suggest-meal", {
    body: {
      hotel_id: values.hotelId,
      party_size: values.partySize,
      budget: values.budget,
      veg_pref: values.vegPref,
      spice_pref: values.spicePref,
      allergies: values.allergies
    }
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No suggestion returned.");
  return data;
}

export async function confirmOrder(orderId: string, suggestion: Suggestion): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const finalItems = [...suggestion.starters, ...suggestion.mains];
  const { error } = await supabase
    .from("orders")
    .update({
      status: "confirmed",
      final_items: finalItems,
      total_price: suggestion.total_price
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}
