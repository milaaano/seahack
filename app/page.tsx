import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { dolls } from "@/lib/dolls";

const HERO_IDS = ["wren", "mia", "grady", "paloma"];

export default function Landing() {
  const heroDolls = HERO_IDS.map((id) => dolls.find((d) => d.id === id)!);

  return (
    <main className="flex-1">
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-terracotta-deep mb-4 animate-fade-up">
          Organic · Heirloom · Handcrafted
        </p>
        <h1
          className="text-4xl sm:text-6xl font-semibold text-sage-dark leading-tight animate-fade-up"
          style={{ animationDelay: "0.08s" }}
        >
          Wrapped in Love,
          <br />
          Woven with Purpose
        </h1>
        <p
          className="mt-5 max-w-xl mx-auto text-ink-soft text-lg animate-fade-up"
          style={{ animationDelay: "0.16s" }}
        >
          Every Apple Park friend is made of organic cotton, filled with corn
          fiber, and waiting for one special child. Don&apos;t pick a toy —
          meet a friend.
        </p>
        <div
          className="mt-8 animate-fade-up"
          style={{ animationDelay: "0.24s" }}
        >
          <Link
            href="/find"
            className="inline-block bg-terracotta hover:bg-terracotta-deep text-cream text-lg font-semibold px-10 py-4 rounded-full shadow-lg shadow-terracotta/25 transition-all hover:scale-[1.03]"
          >
            Find your child&apos;s friend ✨
          </Link>
          <p className="mt-3 text-sm text-ink-soft">
            A few gentle questions · a perfect match · their own storybook
          </p>
        </div>
      </section>

      {/* Real product strip */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {heroDolls.map((d, i) => (
            <Link
              key={d.id}
              href="/find"
              className="group bg-cream rounded-3xl p-4 border border-linen shadow-sm hover:shadow-md transition-all animate-fade-up"
              style={{ animationDelay: `${0.3 + i * 0.08}s` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.image}
                alt={`${d.name}, an Apple Park organic doll`}
                className="w-full aspect-square object-cover rounded-2xl group-hover:scale-[1.02] transition-transform"
              />
              <div className="mt-3 flex items-baseline justify-between px-1">
                <span className="font-display text-lg text-sage-dark">
                  {d.name}
                </span>
                <span className="text-sm text-ink-soft">${d.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand values */}
      <section className="bg-cream border-t border-linen">
        <div className="max-w-5xl mx-auto px-6 py-12 grid sm:grid-cols-3 gap-8 text-center">
          {[
            ["🌱", "100% GOTS organic cotton", "Zero plastics — BPA and phthalate free"],
            ["🌽", "Corn-fiber filled", "Naturally hypoallergenic, never polyester"],
            ["📖", "A story of their own", "Every friend comes with their own storybook"],
          ].map(([icon, title, sub]) => (
            <div key={title}>
              <div className="text-3xl mb-2">{icon}</div>
              <h3 className="font-display text-lg text-sage-dark">{title}</h3>
              <p className="text-sm text-ink-soft mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-ink-soft">
        SEA Hacks prototype · real products from appleparkkids.com
      </footer>
    </main>
  );
}
