"use client";

import { RefreshCw } from "lucide-react";

export function SwapItemButton({ disabled = false, onClick }: { disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title="Mark unavailable and create a new suggestion"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink/10 bg-white text-ink/55 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw size={16} />
    </button>
  );
}
