import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="w-full bg-cream/80 backdrop-blur border-b border-linen sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-sage-dark tracking-tight">
            Apple Park
          </span>
          <span className="hidden sm:inline text-xs uppercase tracking-[0.2em] text-ink-soft">
            Organic Toys
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-soft">
          <Link href="/find" className="hover:text-sage-deep transition-colors">
            Gift Finder
          </Link>
          <span className="hidden sm:inline cursor-default">Our Story</span>
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-linen text-sage-dark cursor-default"
            aria-label="Cart"
          >
            🧺
          </span>
        </nav>
      </div>
    </header>
  );
}
