import Link from "next/link";
import { ArrowRight, LayoutDashboard, Sparkles } from "lucide-react";

const demoHotelId = "11111111-1111-1111-1111-111111111111";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-5xl justify-end">
        <Link
          href="/register"
          className="inline-flex h-10 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:border-leaf hover:text-leaf"
        >
          Hotel registration
        </Link>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center gap-8">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-leaf/20 bg-white/80 px-3 py-1 text-sm font-medium text-leaf">
            <Sparkles size={16} />
            AI meal suggestions for restaurant tables
          </div>
          <h1 className="text-5xl font-semibold tracking-normal text-ink sm:text-7xl">TableAI</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/72">
            Guests enter party size, budget, and preferences, then get a ready-to-confirm combo sized from the live menu.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/order?hotel_id=${demoHotelId}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink px-5 font-semibold text-white shadow-soft transition hover:bg-leaf"
          >
            Try guest flow
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-md border border-ink/15 bg-white px-5 font-semibold text-ink transition hover:border-leaf hover:text-leaf"
          >
            <LayoutDashboard size={18} />
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
