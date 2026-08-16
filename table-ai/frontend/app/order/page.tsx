import { Suspense } from "react";
import { OrderClient } from "@/app/order/OrderClient";

export default function OrderPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-linen px-4 py-8 text-ink">Loading TableAI...</main>}>
      <OrderClient />
    </Suspense>
  );
}
