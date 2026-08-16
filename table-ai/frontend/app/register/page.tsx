"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, Loader2, Save } from "lucide-react";
import { saveHotel } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Hotel } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleHotelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    try {
      const savedHotel = await saveHotel({
        name: String(formData.get("name") || "").trim(),
        location: String(formData.get("location") || "").trim(),
        ownerName: String(formData.get("ownerName") || "").trim(),
        mobileNumber: String(formData.get("mobileNumber") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        ownerPin: String(formData.get("ownerPin") || "").trim(),
        currency: String(formData.get("currency") || "INR").trim(),
      });

      window.localStorage.setItem("tableai_hotel_id", savedHotel.id);
      setMessage("Hotel registered successfully. Redirecting to dashboard...");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save hotel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink">
            <ChefHat className="text-leaf" size={24} />
            TableAI Owner Portal
          </Link>
        </header>

        {!isSupabaseConfigured ? (
          <div className="rounded-md border border-saffron/30 bg-saffron/10 p-4 text-sm text-ink/75">
            Add Supabase values in frontend/.env.local before using the owner portal.
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {message ? <div className="mb-4 rounded-md border border-leaf/20 bg-leaf/5 p-3 text-sm text-leaf">{message}</div> : null}

        <section className="mx-auto max-w-2xl rounded-md border border-ink/10 bg-white/90 p-5 shadow-soft">
          <div className="mb-5 grid grid-cols-2 rounded-md border border-ink/10 p-1">
            <Link href="/login" className="flex h-10 items-center justify-center rounded-md font-semibold text-ink">
              Login
            </Link>
            <button type="button" className="h-10 rounded-md font-semibold bg-ink text-white">
              Register hotel
            </button>
          </div>

          <HotelForm hotel={null} loading={loading} onSubmit={handleHotelSubmit} />
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
            <button disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 font-semibold text-white disabled:opacity-70">
        {loading ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
        {hotel ? "Update hotel" : "Register hotel"}
      </button>
    </form>
  );
}