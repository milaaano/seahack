"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { dolls } from "@/lib/dolls";

type Msg = { role: "assistant" | "user"; text: string };
type Rec = { dollId: string; reason: string };

const FIELD_KEYS = ["childName", "age", "occasion", "personality"] as const;
const PLACEHOLDERS = [
  "Their name…",
  "Their age…",
  "Birthday, holiday, just because…",
  "What do they love? What are they like?",
];

async function streamInto(
  url: string,
  body: unknown,
  onChunk: (t: string) => void
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(dec.decode(value, { stream: true }));
  }
}

export default function FindPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [phase, setPhase] = useState<"chat" | "matching" | "results">("chat");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [childName, setChildName] = useState("your little one");
  const answersRef = useRef<Record<string, string>>({});
  const startedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  async function askQuestion(nextStep: number) {
    setAsking(true);
    setMessages((m) => [...m, { role: "assistant", text: "" }]);
    await streamInto(
      "/api/chat",
      { step: nextStep, answers: answersRef.current },
      (chunk) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            text: copy[copy.length - 1].text + chunk,
          };
          return copy;
        })
    );
    setAsking(false);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    askQuestion(0);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const answer = input.trim();
    if (!answer || asking) return;
    setInput("");
    answersRef.current[FIELD_KEYS[step]] = answer;
    if (step === 0) setChildName(answer);
    setMessages((m) => [...m, { role: "user", text: answer }]);

    if (step < 3) {
      const next = step + 1;
      setStep(next);
      await askQuestion(next);
    } else {
      setPhase("matching");
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answersRef.current),
        });
        const data = await res.json();
        setRecs(data.recommendations ?? []);
      } catch {
        setRecs([]);
      }
      setPhase("results");
    }
  }

  function pickDoll(dollId: string) {
    sessionStorage.setItem("apk-answers", JSON.stringify(answersRef.current));
    router.push(`/meet/${dollId}`);
  }

  return (
    <main className="flex-1 flex flex-col">
      <SiteHeader />

      <div className="max-w-2xl w-full mx-auto px-6 py-8 flex-1 flex flex-col">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl text-sage-dark">
            Let&apos;s find their friend
          </h1>
          {phase === "chat" && (
            <p className="text-sm text-ink-soft mt-1">
              Question {Math.min(step + 1, 4)} of 4
            </p>
          )}
        </div>

        {/* Chat transcript */}
        <div className="flex-1 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-5 py-3 rounded-3xl text-[15px] leading-relaxed animate-fade-up ${
                  m.role === "user"
                    ? "bg-sage-deep text-cream rounded-br-lg"
                    : "bg-cream border border-linen text-ink rounded-bl-lg shadow-sm"
                }`}
              >
                {m.text || (
                  <span className="inline-flex gap-1 py-1">
                    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sage inline-block" />
                    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sage inline-block" />
                    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sage inline-block" />
                  </span>
                )}
              </div>
            </div>
          ))}

          {phase === "matching" && (
            <div className="text-center py-10 animate-fade-up">
              <div className="text-4xl animate-gentle-bob">🧸</div>
              <p className="mt-3 font-display text-xl text-sage-dark">
                Walking through the park to find {childName}&apos;s friend…
              </p>
            </div>
          )}

          {phase === "results" && (
            <div className="pt-4">
              <p className="text-center font-display text-2xl text-sage-dark mb-6 animate-fade-up">
                Three friends can&apos;t wait to meet {childName}
              </p>
              <div className="grid gap-5">
                {recs.map((r, i) => {
                  const doll = dolls.find((d) => d.id === r.dollId);
                  if (!doll) return null;
                  return (
                    <button
                      key={r.dollId}
                      onClick={() => pickDoll(r.dollId)}
                      className="group text-left bg-cream border border-linen rounded-3xl p-4 flex gap-5 items-center shadow-sm hover:shadow-lg hover:border-sage transition-all animate-fade-up"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doll.image}
                        alt={doll.name}
                        className="w-28 h-28 object-cover rounded-2xl flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <h3 className="font-display text-xl text-sage-dark">
                            {doll.name}
                          </h3>
                        </div>
                        <p className="text-sm text-ink-soft mt-1 leading-relaxed">
                          {r.reason}
                        </p>
                        <span className="inline-block mt-2 text-sm font-semibold text-terracotta-deep group-hover:translate-x-1 transition-transform">
                          Meet {doll.name} →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {phase === "chat" && (
          <form onSubmit={handleSubmit} className="mt-6 flex gap-3 sticky bottom-6">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDERS[step]}
              autoFocus
              className="flex-1 bg-cream border border-linen rounded-full px-6 py-4 text-[15px] outline-none focus:border-sage shadow-sm placeholder:text-ink-soft/60"
            />
            <button
              type="submit"
              disabled={asking || !input.trim()}
              className="bg-terracotta hover:bg-terracotta-deep disabled:opacity-40 text-cream font-semibold px-7 rounded-full transition-colors"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
