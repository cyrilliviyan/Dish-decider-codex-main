"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ChefHat, ClipboardList } from "lucide-react";
import { confirmOrder, fetchHotel, fetchMenu, requestSuggestion, updateMenuAvailability } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Hotel, MenuItem, OrderFormValues, Suggestion } from "@/lib/types";
import { OrderForm } from "@/components/OrderForm";
import { SuggestionResult } from "@/components/SuggestionResult";
import { SurpriseMeButton } from "@/components/SurpriseMeButton";

const demoHotelId = "11111111-1111-1111-1111-111111111111";
const location = ["Tambaram", "Velachery", "Adyar", "T Nagar", "Anna Nagar", "Porur", "Chromepet", "Guindy", "Mylapore", "Kotturpuram"];
const HotelName = ["Kaadai king", "Anjappar", "Sangeetha", "Saravana Bhavan", "Murugan Idli Shop", "Dindigul Thalappakatti", "Junior Kuppanna", "Hotel Saravana Bhavan", "A2B - Adyar Ananda Bhavan", "Thalapakatti Biriyani"];

export function OrderClient() {
  const searchParams = useSearchParams();
  const hotelId = searchParams.get("hotel_id") || demoHotelId;
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation,setSelectedLocation] = useState("");
  const [selectedHotel,setSelectedHotel] = useState("");

  const currency = hotel?.currency ?? "INR";

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const [hotelData, menuData] = await Promise.all([fetchHotel(hotelId), fetchMenu(hotelId)]);
        if (!mounted) return;
        setHotel(hotelData);
        setMenu(menuData);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load the menu.");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [hotelId]);

  const menuStats = useMemo(() => {
    const starters = menu.filter((item) => item.category === "starter").length;
    const mains = menu.filter((item) => item.category === "main" || item.category === "bread" || item.category === "rice").length;
    return { starters, mains };
  }, [menu]);

  async function handleSuggest(values: OrderFormValues) {
    setLoading(true);
    setError(null);
    setConfirmed(false);
    try {
      const nextSuggestion = await requestSuggestion(values);
      setSuggestion(nextSuggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create a suggestion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!suggestion?.order_id) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmOrder(suggestion.order_id, suggestion);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm the order.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleUnavailable(itemId: string) {
    setError(null);
    try {
      await updateMenuAvailability(itemId, false);
      setMenu((current) => current.filter((item) => item.id !== itemId));
      setSuggestion(null);
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update menu availability.");
    }
  }

  return (
  <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink">
          <ChefHat className="text-leaf" size={24} />
          TableAI
        </Link>
        <div className="rounded-full border border-ink/10 bg-white px-3 py-1 text-sm font-semibold text-ink/65">
          Hotel menu
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
          <div className="mb-5">
            <p className="text-sm font-semibold text-leaf">{hotel?.name ?? "Sample Indian Bistro"}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">Tell us your table mood.</h1>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              We will size starters and mains for your group from the live menu, budget, spice level, and preferences.
            </p>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-ink/75">Select Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink/20 bg-white py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-saffron"
            >
              <option value="">-- Select Location --</option>
              {location.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-ink/75">Select Hotel</label>
            <select
              value={selectedHotel}
              onChange={(e) => setSelectedHotel(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink/20 bg-white py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-saffron"
            >
              <option value="">-- Select Hotel --</option>
              {HotelName.map((hotel) => (
                <option key={hotel} value={hotel}>
                  {hotel}
                </option>
              ))}
            </select>
          </div>

          {selectedLocation && selectedHotel ? (
            <>
              {!isSupabaseConfigured && location[0]?.length > 9 ? (
                <div className="rounded-md border border-saffron/30 bg-saffron/10 p-4 text-sm leading-6 text-ink/75">
                  Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local, then run the Supabase migration and seed to activate the live guest flow.
                </div>
              ) : (
                <>
                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-linen p-3">
                      <p className="text-xs font-semibold uppercase tracking-normal text-ink/50">Starters</p>
                      <p className="mt-1 text-xl font-bold">{menuStats.starters}</p>
                    </div>
                    <div className="rounded-md bg-linen p-3">
                      <p className="text-xs font-semibold uppercase tracking-normal text-ink/50">Mains</p>
                      <p className="mt-1 text-xl font-bold">{menuStats.mains}</p>
                    </div>
                  </div>
                  <OrderForm hotelId={hotelId} loading={loading} onSubmit={handleSuggest} />
                  <div className="mt-4">
                    <SurpriseMeButton hotelId={hotelId} disabled={loading} onClick={handleSuggest} />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="rounded-md border border-dashed border-ink/15 bg-linen/60 p-6 text-center text-sm text-ink/60">
              Please select a location and hotel to continue.
            </div>
          )}
        </div>

        {selectedLocation && selectedHotel ? (
          <div className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList className="text-saffron" size={22} />
              <h2 className="text-xl font-bold text-ink">Suggested combo</h2>
            </div>

            {error ? (
              <div className="mb-5 flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                {error}
              </div>
            ) : null}

            {suggestion ? (
              <SuggestionResult
                suggestion={suggestion}
                currency={currency}
                confirming={confirming}
                confirmed={confirmed}
                onConfirm={handleConfirm}
                onUnavailable={handleUnavailable}
              />
            ) : (
              <div className="flex min-h-[24rem] items-center justify-center rounded-md border border-dashed border-ink/15 bg-linen/60 p-6 text-center text-ink/60">
                Your starters, mains, quantities, and total will appear here after submission.
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[24rem] items-center justify-center rounded-md border border-dashed border-ink/15 bg-white/90 p-6 text-center text-ink/60 shadow-soft">
            Select a location and hotel to view available menu options and recommendations.
          </div>
        )}
      </section>
    </div>
  </main>
)};