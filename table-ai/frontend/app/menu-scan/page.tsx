"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChefHat, Loader2, Sparkles } from "lucide-react";
import { fetchAllMenu, fetchHotel, parseMenuText, saveMenuItem } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Hotel, MenuItem, ParsedMenuItem } from "@/lib/types";

export default function MenuScanPage() {
  const router = useRouter();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [menuText, setMenuText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedHotelId = window.localStorage.getItem("tableai_hotel_id");
    if (savedHotelId) {
      loadHotelWorkspace(savedHotelId);
    } else {
      router.push("/login");
    }
  }, [router]);

  async function loadHotelWorkspace(hotelId: string) {
    try {
      if (isSupabaseConfigured) {
        const [hotelData, menuData] = await Promise.all([
          fetchHotel(hotelId),
          fetchAllMenu(hotelId),
        ]);

        if (hotelData) {
          setHotel(hotelData);
          setMenu(menuData);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not load hotel data.");
    }
  }

  async function handleParseMenu() {
    if (!menuText.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const items = await parseMenuText(menuText);
      setParsedItems(items);
      setMessage(`AI found ${items.length} menu items.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to scan menu.");
    } finally {
      setLoading(false);
    }
  }

  async function addParsedItem(item: ParsedMenuItem) {
    if (!hotel?.id) return;
    try {
      const saved = await saveMenuItem({ ...item, hotelId: hotel.id, isAvailable: true });
      setMenu((current) => [...current, saved]);
      setParsedItems((current) => current.filter((entry) => entry !== item));
      setMessage(`Added ${item.name} to menu.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add menu item.");
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-ink hover:text-ink/80">
            <ArrowLeft size={20} />
            <span className="font-semibold">Back to dashboard</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink">
            <ChefHat className="text-leaf" size={24} />
            TableAI
          </Link>
        </header>

        {!isSupabaseConfigured ? (
          <div className="rounded-md border border-saffron/30 bg-saffron/10 p-4 text-sm text-ink/75 mb-4">
            Add Supabase values in frontend/.env.local before using this feature.
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {message ? <div className="mb-4 rounded-md border border-leaf/20 bg-leaf/5 p-3 text-sm text-leaf">{message}</div> : null}

        {hotel ? (
          <section className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft mb-6">
            <h1 className="text-2xl font-bold text-ink mb-2">{hotel.name}</h1>
            <p className="text-sm text-ink/60">{hotel.location}</p>
          </section>
        ) : null}

        <section className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
          <h2 className="mb-4 text-xl font-bold text-ink">AI menu scan</h2>
          <p className="mb-4 text-sm text-ink/70">
            Paste your menu text here. The AI will parse it and extract menu items.
          </p>
          <p className="mb-4 text-xs text-ink/60 bg-ink/5 p-3 rounded-md">
            <strong>Example format:</strong> Paneer Tikka - starter - 320 - veg - medium - serves 2
          </p>

          <textarea
            value={menuText}
            onChange={(event) => setMenuText(event.target.value)}
            rows={10}
            placeholder="Paste menu text here. Each item should include: name - category - price - veg/non-veg - spice level - serves count"
            className="w-full resize-none rounded-md border border-ink/15 px-3 py-3 mb-3 font-mono text-sm"
          />

          <button
            type="button"
            disabled={loading || !menuText.trim()}
            onClick={handleParseMenu}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-saffron px-4 font-semibold text-white disabled:opacity-70"
          >
            <Sparkles size={17} />
            {loading ? "Scanning..." : "Scan menu"}
          </button>
        </section>

        {parsedItems.length > 0 ? (
          <section className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft mt-6">
            <h2 className="mb-4 text-xl font-bold text-ink">
              Found {parsedItems.length} item{parsedItems.length !== 1 ? "s" : ""}
            </h2>
            <div className="space-y-2">
              {parsedItems.map((item) => (
                <div
                  key={`${item.name}-${item.price}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-ink/10 p-3"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-ink/60">
                      {item.category} • {item.spice_level} • serves {item.serves_count} • {item.veg_flag ? "veg" : "non-veg"} • ₹{item.price}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addParsedItem(item)}
                    disabled={loading}
                    className="rounded-md bg-leaf px-4 py-2 font-semibold text-white text-sm disabled:opacity-70"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {menu.length > 0 ? (
          <section className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft mt-6">
            <h2 className="mb-4 text-xl font-bold text-ink">
              Your menu ({menu.length} items)
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {menu.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-ink/10 p-3">
                  <div>
                    <p className="font-semibold text-ink text-sm">{item.name}</p>
                    <p className="text-xs text-ink/60">
                      {item.category} • {item.spice_level} • {item.veg_flag ? "veg" : "non-veg"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink whitespace-nowrap">₹{item.price}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
