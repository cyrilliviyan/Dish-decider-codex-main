"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import type { OrderFormValues, SpicePreference, VegPreference } from "@/lib/types";

type Props = {
  hotelId: string;
  loading: boolean;
  onSubmit: (values: OrderFormValues) => void;
};

export function OrderForm({ hotelId, loading, onSubmit }: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onSubmit({
      hotelId,
      partySize: Number(formData.get("partySize") || 2),
      budget: Number(formData.get("budget") || 1200),
      vegPref: String(formData.get("vegPref") || "mixed") as VegPreference,
      spicePref: String(formData.get("spicePref") || "medium") as SpicePreference,
      allergies: String(formData.get("allergies") || "").trim()
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-ink/70">Party size</span>
          <input
            name="partySize"
            type="number"
            min={1}
            max={30}
            defaultValue={4}
            className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base outline-none ring-leaf/20 focus:border-leaf focus:ring-4"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-ink/70">Budget</span>
          <input
            name="budget"
            type="number"
            min={200}
            step={50}
            defaultValue={1800}
            className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base outline-none ring-leaf/20 focus:border-leaf focus:ring-4"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-ink/70">Food preference</span>
        <select name="vegPref" defaultValue="mixed" className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 outline-none ring-leaf/20 focus:border-leaf focus:ring-4">
          <option value="veg">Vegetarian</option>
          <option value="non_veg">Non-vegetarian</option>
          <option value="mixed">Mixed table</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-ink/70">Spice level</span>
        <select name="spicePref" defaultValue="medium" className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 outline-none ring-leaf/20 focus:border-leaf focus:ring-4">
          <option value="mild">Mild</option>
          <option value="medium">Medium</option>
          <option value="hot">Hot</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-ink/70">Allergies</span>
        <textarea
          name="allergies"
          rows={3}
          placeholder="Optional, e.g. nuts, shellfish, dairy"
          className="w-full resize-none rounded-md border border-ink/15 bg-white px-3 py-3 outline-none ring-leaf/20 focus:border-leaf focus:ring-4"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 font-semibold text-white transition hover:bg-leaf disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
        Get AI combo
      </button>
    </form>
  );
}
