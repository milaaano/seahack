"use client";

import { use, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getDoll } from "@/lib/dolls";

export default function UnlockPage({
  params,
}: {
  params: Promise<{ dollId: string }>;
}) {
  const { dollId } = use(params);
  const doll = getDoll(dollId);
  // Try the "continued" clip first; fall back to the chapter-one clip.
  const [src, setSrc] = useState(`/videos/${dollId}-full.mp4`);
  const [videoOk, setVideoOk] = useState(true);

  if (!doll) {
    return (
      <main className="flex-1">
        <SiteHeader />
        <div className="text-center py-20">
          <p className="font-display text-2xl text-sage-dark">
            Hmm, that friend wandered off…
          </p>
          <Link href="/" className="text-terracotta-deep underline mt-2 inline-block">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <SiteHeader />

      <section className="max-w-2xl mx-auto px-6 pt-12 pb-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-terracotta-deep animate-fade-up">
          🔓 Story unlocked
        </p>
        <h1
          className="font-display text-4xl font-semibold text-sage-dark mt-3 animate-fade-up"
          style={{ animationDelay: "0.08s" }}
        >
          {doll.name} finishes the story
        </h1>
        <p
          className="text-ink-soft mt-2 animate-fade-up"
          style={{ animationDelay: "0.14s" }}
        >
          You found {doll.name}&apos;s secret tag — here&apos;s what happened
          next.
        </p>

        {videoOk ? (
          <video
            key={src}
            src={src}
            poster={doll.image}
            controls
            playsInline
            preload="metadata"
            onError={() => {
              if (src.endsWith("-full.mp4")) setSrc(`/videos/${dollId}.mp4`);
              else setVideoOk(false);
            }}
            className="w-full rounded-[2rem] shadow-lg border border-linen bg-sage-dark mt-8"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={doll.image}
            alt={doll.name}
            className="w-64 h-64 object-cover rounded-[2.5rem] mx-auto mt-8 shadow-xl border-4 border-cream"
          />
        )}

        <div className="bg-cream border border-linen rounded-3xl p-8 mt-10 animate-fade-up">
          <h2 className="font-display text-2xl text-sage-dark">
            The story never has to end
          </h2>
          <p className="text-ink-soft mt-2 max-w-md mx-auto">
            Every Apple Park friend carries one chapter of the same big story.
            Meet a new friend, unlock the next chapter — and build a whole
            bookshelf of adventures.
          </p>
          <Link
            href="/find"
            className="inline-block mt-6 bg-terracotta hover:bg-terracotta-deep text-cream font-semibold px-8 py-3.5 rounded-full shadow-lg shadow-terracotta/25 transition-all hover:scale-[1.03]"
          >
            Meet the next friend ✨
          </Link>
        </div>
      </section>
    </main>
  );
}
