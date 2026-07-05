"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import SiteHeader from "@/components/SiteHeader";
import { getDoll } from "@/lib/dolls";

export default function MeetPage({
  params,
}: {
  params: Promise<{ dollId: string }>;
}) {
  const { dollId } = use(params);
  const doll = getDoll(dollId);

  const [story, setStory] = useState("");
  const [storyDone, setStoryDone] = useState(false);
  const [childName, setChildName] = useState("your little one");
  const [videoOk, setVideoOk] = useState(true);
  const [added, setAdded] = useState(false);
  const startedRef = useRef(false);

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const unlockUrl = origin ? `${origin}/unlock/${dollId}` : "";

  useEffect(() => {
    if (!doll || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      let answers: Record<string, string> = {};
      try {
        answers = JSON.parse(sessionStorage.getItem("apk-answers") ?? "{}");
      } catch {}
      if (answers.childName) setChildName(answers.childName);

      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dollId, ...answers }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setStory((s) => s + dec.decode(value, { stream: true }));
      }
      setStoryDone(true);
    })();
  }, [doll, dollId]);

  if (!doll) {
    return (
      <main className="flex-1">
        <SiteHeader />
        <div className="text-center py-20">
          <p className="font-display text-2xl text-sage-dark">
            Hmm, that friend wandered off…
          </p>
          <Link href="/find" className="text-terracotta-deep underline mt-2 inline-block">
            Find another friend
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-terracotta-deep animate-fade-up">
          A friendship begins
        </p>
        <h1
          className="font-display text-4xl sm:text-5xl font-semibold text-sage-dark mt-3 animate-fade-up"
          style={{ animationDelay: "0.08s" }}
        >
          Meet {doll.name}
        </h1>
        <p
          className="text-ink-soft mt-2 animate-fade-up"
          style={{ animationDelay: "0.14s" }}
        >
          {doll.name} &amp; {childName} — best friends in the making
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doll.image}
          alt={doll.name}
          className="w-64 h-64 object-cover rounded-[2.5rem] mx-auto mt-8 shadow-xl shadow-sage/20 border-4 border-cream animate-gentle-bob"
        />
      </section>

      {/* Story */}
      <section className="max-w-2xl mx-auto px-6 mt-12">
        <div className="bg-cream border border-linen rounded-[2rem] px-8 py-10 shadow-sm">
          <h2 className="font-display text-2xl text-sage-dark text-center mb-6">
            {doll.name} &amp; {childName}
            <span className="block text-sm font-sans text-ink-soft mt-1 tracking-wide">
              Chapter One · written just for {childName}
            </span>
          </h2>
          <div className="text-[17px] leading-8 text-ink whitespace-pre-line font-[450]">
            {story || (
              <span className="inline-flex gap-1">
                <span className="typing-dot w-2 h-2 rounded-full bg-sage inline-block" />
                <span className="typing-dot w-2 h-2 rounded-full bg-sage inline-block" />
                <span className="typing-dot w-2 h-2 rounded-full bg-sage inline-block" />
              </span>
            )}
            {story && !storyDone && (
              <span className="inline-block w-0.5 h-5 bg-sage-deep ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        </div>
      </section>

      {/* Video */}
      {videoOk && (
        <section className="max-w-2xl mx-auto px-6 mt-10 text-center">
          <h3 className="font-display text-xl text-sage-dark mb-4">
            Watch {doll.name}&apos;s story come to life
          </h3>
          <video
            src={`/videos/${doll.id}.mp4`}
            poster={doll.image}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoOk(false)}
            className="w-full rounded-[2rem] shadow-lg border border-linen bg-sage-dark"
          />
          <p className="text-sm text-ink-soft mt-3 italic">
            …the story pauses right at the good part. {doll.name} knows how it
            ends — bring them home to find out.
          </p>
        </section>
      )}

      {/* Buy CTA */}
      <section className="max-w-2xl mx-auto px-6 mt-12 text-center">
        {!added ? (
          <button
            onClick={() => setAdded(true)}
            className="bg-terracotta hover:bg-terracotta-deep text-cream text-lg font-semibold px-10 py-4 rounded-full shadow-lg shadow-terracotta/25 transition-all hover:scale-[1.03]"
          >
            Bring {doll.name} home for {childName} — ${doll.price}
          </button>
        ) : (
          <div className="bg-sage-deep text-cream rounded-3xl px-8 py-6 animate-fade-up">
            <p className="font-display text-xl">
              🎁 {doll.name} is getting ready to meet {childName}!
            </p>
            <p className="text-sm text-cream/80 mt-2">
              Add a matching outfit ($24) and unlock free shipping over $75.
            </p>
          </div>
        )}
        <p className="text-xs text-ink-soft mt-3">
          Organic cotton · corn-fiber filled · zero plastics
        </p>
      </section>

      {/* QR + next chapter teaser */}
      <section className="max-w-2xl mx-auto px-6 mt-12 mb-16 grid sm:grid-cols-2 gap-5">
        <div className="bg-cream border border-linen rounded-3xl p-6 text-center">
          <h4 className="font-display text-lg text-sage-dark">
            Inside the box
          </h4>
          <p className="text-sm text-ink-soft mt-1 mb-4">
            {childName} scans {doll.name}&apos;s tag to hear the rest of the
            story
          </p>
          <div className="bg-white p-3 rounded-2xl inline-block">
            {unlockUrl && <QRCode value={unlockUrl} size={120} fgColor="#3f4a37" />}
          </div>
        </div>
        <div className="bg-sage-dark text-cream rounded-3xl p-6 text-center flex flex-col justify-center">
          <h4 className="font-display text-lg">Chapter Two is waiting…</h4>
          <p className="text-sm text-cream/80 mt-2">
            Every new friend {childName} meets unlocks the next chapter of the
            Apple Park story.
          </p>
          <Link
            href="/find"
            className="mt-4 inline-block text-sm font-semibold text-oat underline underline-offset-4"
          >
            Meet another friend →
          </Link>
        </div>
      </section>
    </main>
  );
}
