"use client";

import { Shuffle } from "lucide-react";
import type { OrderFormValues } from "@/lib/types";

type Props = {
  hotelId: string;
  disabled: boolean;
  onClick: (values: OrderFormValues) => void;
};

export function SurpriseMeButton({ hotelId, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onClick({
          hotelId,
          partySize: 4,
          budget: 1800,
          vegPref: "mixed",
          spicePref: "medium",
          allergies: ""
        })
      }
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-saffron/30 bg-white px-4 font-semibold text-saffron transition hover:border-saffron hover:bg-saffron hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      <Shuffle size={17} />
      Surprise me
    </button>
  );
}
