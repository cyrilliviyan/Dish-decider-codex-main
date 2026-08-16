"use client";

import { CheckCircle2, IndianRupee } from "lucide-react";
import type { SuggestedItem, Suggestion } from "@/lib/types";
import { SwapItemButton } from "@/components/SwapItemButton";

type Props = {
  suggestion: Suggestion;
  currency: string;
  confirming: boolean;
  confirmed: boolean;
  onConfirm: () => void;
  onUnavailable: (itemId: string) => void;
};

function Items({ title, items, currency, onUnavailable }: { title: string; items: SuggestedItem[]; currency: string; onUnavailable: (itemId: string) => void }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-normal text-ink/55">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.item_id} className="rounded-md border border-ink/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{item.quantity} x {item.name}</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">{item.reason}</p>
              </div>
              <SwapItemButton onClick={() => onUnavailable(item.item_id)} />
            </div>
            <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-ink/70">
              {currency === "INR" ? <IndianRupee size={14} /> : currency}
              {item.line_total}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SuggestionResult({ suggestion, currency, confirming, confirmed, onConfirm, onUnavailable }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-leaf/20 bg-leaf/5 p-4">
        <p className="text-sm font-semibold text-leaf">{suggestion.source === "fallback" ? "Smart fallback combo" : "AI combo suggestion"}</p>
        <p className="mt-2 text-base leading-7 text-ink/75">{suggestion.summary}</p>
      </div>

      <Items title="Starters" items={suggestion.starters} currency={currency} onUnavailable={onUnavailable} />
      <Items title="Main course" items={suggestion.mains} currency={currency} onUnavailable={onUnavailable} />

      <div className="flex items-center justify-between rounded-md bg-ink px-4 py-4 text-white">
        <span className="font-semibold">Estimated total</span>
        <span className="text-xl font-bold">{currency === "INR" ? "₹" : currency} {suggestion.total_price}</span>
      </div>

      <button
        type="button"
        disabled={confirming || confirmed || !suggestion.order_id}
        onClick={onConfirm}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
      >
        <CheckCircle2 size={18} />
        {confirmed ? "Order confirmed" : confirming ? "Confirming..." : "Confirm order"}
      </button>
    </div>
  );
}
