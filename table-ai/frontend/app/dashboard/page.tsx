"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChefHat, Loader2, Plus, Save, Sparkles as SparklesIcon } from "lucide-react";
import { fetchAllMenu, fetchHotel, saveHotel, saveMenuItem, updateMenuAvailability } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Hotel, MenuCategory, MenuItem, SpicePreference } from "@/lib/types";

const categories: MenuCategory[] = ["starter", "main", "bread", "rice", "dessert", "drink"];
const spiceLevels: SpicePreference[] = ["mild", "medium", "hot"];

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-linen px-4 py-8 text-ink">Loading dashboard...</main>}>
      <OwnerPortal />
    </Suspense>
  );
}

function OwnerPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hotelIdFromUrl = searchParams.get("hotel_id");
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedHotelId = window.localStorage.getItem("tableai_hotel_id");
    const activeHotelId = hotelIdFromUrl || savedHotelId;
    if (activeHotelId) {
      loadHotelWorkspace(activeHotelId);
    } else {
      router.push("/login");
    }
  }, [hotelIdFromUrl, router]);

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
        window.localStorage.setItem("tableai_hotel_id", hotelData.id);
        return;
      }
    }
  } catch (err) {
    console.warn("Could not load from backend, using mock dashboard data.");
  }

  // Fallback for testing/mock logins
  const mockHotel: Hotel = {
    id: hotelId,
    name: "Test Hotel",
    location: "Test Location",
    owner_name: "Test Owner",
    mobile_number: "1234567890",
    email: hotelId,
    owner_pin: "1234",
    currency: "INR",
  } as Hotel;

  setHotel(mockHotel);
  setMenu([]);
  window.localStorage.setItem("tableai_hotel_id", hotelId);
}

  async function handleHotelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    try {
      const savedHotel = await saveHotel({
        id: hotel?.id,
        name: String(formData.get("name") || "").trim(),
        location: String(formData.get("location") || "").trim(),
        ownerName: String(formData.get("ownerName") || "").trim(),
        mobileNumber: String(formData.get("mobileNumber") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        ownerPin: String(formData.get("ownerPin") || "").trim(),
        currency: String(formData.get("currency") || "INR").trim(),
      });
      setHotel(savedHotel);
      setMenu(await fetchAllMenu(savedHotel.id));
      window.localStorage.setItem("tableai_hotel_id", savedHotel.id);
      setMessage("Hotel details updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save hotel.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMenuSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hotel?.id) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    try {
      const savedItem = await saveMenuItem({
        id: editingItem?.id,
        hotelId: hotel.id,
        name: String(formData.get("name") || "").trim(),
        category: String(formData.get("category") || "main") as MenuCategory,
        price: Number(formData.get("price") || 0),
        vegFlag: formData.get("vegFlag") === "on",
        spiceLevel: String(formData.get("spiceLevel") || "medium") as SpicePreference,
        servesCount: Number(formData.get("servesCount") || 1),
        mustTry: formData.get("mustTry") === "on",
        isAvailable: formData.get("isAvailable") === "on",
      });
      setMenu((current) => (editingItem ? current.map((item) => (item.id === savedItem.id ? savedItem : item)) : [...current, savedItem]));
      setEditingItem(null);
      event.currentTarget.reset();
      setMessage(editingItem ? "Menu item updated." : "Menu item added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save menu item.");
    } finally {
      setLoading(false);
    }
  }



  async function toggleAvailability(item: MenuItem) {
    await updateMenuAvailability(item.id, !item.is_available);
    setMenu((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_available: !entry.is_available } : entry)));
  }

  function logout() {
    window.localStorage.removeItem("tableai_hotel_id");
    setHotel(null);
    setMenu([]);
    setEditingItem(null);
    router.push("/login");
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink">
            <ChefHat className="text-leaf" size={24} />
            TableAI Owner Portal
          </Link>
          {hotel ? (
            <div className="flex flex-wrap gap-3">
              <Link href={`/order?hotel_id=${hotel.id}`} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white">
                Guest page
                <ArrowRight size={16} />
              </Link>
              <button type="button" onClick={logout} className="h-10 rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink">
                Logout
              </button>
            </div>
          ) : null}
        </header>

        {!isSupabaseConfigured ? (
          <div className="rounded-md border border-saffron/30 bg-saffron/10 p-4 text-sm text-ink/75">
            Add Supabase values in frontend/.env.local before using the owner portal.
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {message ? <div className="mb-4 rounded-md border border-leaf/20 bg-leaf/5 p-3 text-sm text-leaf">{message}</div> : null}

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
              <h1 className="mb-4 text-2xl font-bold text-ink">Hotel details</h1>
              <HotelForm hotel={hotel} loading={loading} onSubmit={handleHotelSubmit} />
            </div>

            <MenuForm key={editingItem?.id || "new"} item={editingItem} loading={loading} onSubmit={handleMenuSubmit} onCancel={() => setEditingItem(null)} />
          </div>

          <div className="space-y-5">
            <section className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ink">AI menu scan</h2>
              </div>
              <p className="text-sm text-ink/70 mt-2 mb-4">
                Use our AI-powered menu scanner to quickly add items from your menu.
              </p>
              <Link href="/menu-scan" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-saffron px-4 font-semibold text-white hover:bg-saffron/90">
                <SparklesIcon size={17} />
                Go to Menu Scanner
              </Link>
            </section>

            <section className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
              <h2 className="mb-4 text-xl font-bold text-ink">Menu items</h2>
              <div className="space-y-3">
                {menu.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-ink/10 p-3">
                    <div>
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="mt-1 text-sm text-ink/60">{item.category} | {item.spice_level} | serves {item.serves_count} | {item.veg_flag ? "veg" : "non-veg"} | {hotel?.currency} {item.price}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setEditingItem(item)} className="rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold text-ink">
                        Edit
                      </button>
                      <button type="button" onClick={() => toggleAvailability(item)} className="rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold text-ink">
                        {item.is_available ? "Available" : "Unavailable"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function HotelForm({ hotel, loading, onSubmit }: { hotel: Hotel | null; loading: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input name="name" required defaultValue={hotel?.name ?? ""} placeholder="Hotel name" className="h-11 rounded-md border border-ink/15 px-3" />
      <input name="location" required defaultValue={hotel?.location ?? ""} placeholder="Location" className="h-11 rounded-md border border-ink/15 px-3" />
      <input name="ownerName" required defaultValue={hotel?.owner_name ?? ""} placeholder="Owner name" className="h-11 rounded-md border border-ink/15 px-3" />
      <input name="mobileNumber" required defaultValue={hotel?.mobile_number ?? ""} placeholder="Mobile number" className="h-11 rounded-md border border-ink/15 px-3" />
      <input name="email" type="email" required defaultValue={hotel?.email ?? ""} placeholder="Email" className="h-11 rounded-md border border-ink/15 px-3" />
      <input name="ownerPin" type="password" required defaultValue={hotel?.owner_pin ?? ""} placeholder="Owner PIN" className="h-11 rounded-md border border-ink/15 px-3" />
      <input name="currency" required defaultValue={hotel?.currency ?? "INR"} placeholder="Currency" className="h-11 rounded-md border border-ink/15 px-3" />
      <button disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 font-semibold text-white disabled:opacity-70">
        {loading ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
        {hotel ? "Update hotel" : "Register hotel"}
      </button>
    </form>
  );
}

function MenuForm({
  item,
  loading,
  onSubmit,
  onCancel,
}: {
  item: MenuItem | null;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
      <h2 className="mb-4 text-xl font-bold text-ink">{item ? "Edit menu item" : "Add menu item"}</h2>
      <div className="grid gap-4">
        <input name="name" required defaultValue={item?.name ?? ""} placeholder="Item name" className="h-11 rounded-md border border-ink/15 px-3" />
        <div className="grid grid-cols-2 gap-3">
          <select name="category" defaultValue={item?.category ?? "main"} className="h-11 rounded-md border border-ink/15 px-3">
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <input name="price" type="number" min={0} step={1} required defaultValue={item?.price ?? ""} placeholder="Price" className="h-11 rounded-md border border-ink/15 px-3" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select name="spiceLevel" defaultValue={item?.spice_level ?? "medium"} className="h-11 rounded-md border border-ink/15 px-3">
            {spiceLevels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <input name="servesCount" type="number" min={1} defaultValue={item?.serves_count ?? 2} className="h-11 rounded-md border border-ink/15 px-3" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/70"><input name="vegFlag" type="checkbox" defaultChecked={item?.veg_flag ?? true} /> Vegetarian</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/70"><input name="mustTry" type="checkbox" defaultChecked={item?.must_try ?? false} /> Must try</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/70"><input name="isAvailable" type="checkbox" defaultChecked={item?.is_available ?? true} /> Available</label>
      </div>
      <div className="mt-4 flex gap-3">
        <button disabled={loading} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-leaf px-4 font-semibold text-white disabled:opacity-70">
          <Plus size={17} />
          {item ? "Update item" : "Add item"}
        </button>
        {item ? (
          <button type="button" onClick={onCancel} className="h-11 rounded-md border border-ink/15 bg-white px-4 font-semibold text-ink">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}