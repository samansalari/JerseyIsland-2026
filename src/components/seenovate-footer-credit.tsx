"use client";

/**
 * Client-only: anchor hover (gold → jersey red) and heart scale on row hover.
 * Muted text uses on-primary at opacity so the line stays readable on `bg-navy` footer.
 */
export function SeenovateFooterCredit() {
  return (
    <div className="group mt-3 flex items-center justify-center gap-1.5 flex-wrap">
      {/* ✓ WCAG — text-on-primary/60 on navy ≈ 6:1 (was /50 ≈ 4.8:1 — bumped) */}
      <span className="text-xs text-on-primary/60">Made with</span>
      <span
        aria-hidden="true"
        className="text-xs select-none transition-transform duration-300 group-hover:scale-125"
        style={{ color: "#A31621" }}
      >
        ♥
      </span>
      <span className="text-xs text-on-primary/60">for Jersey Island 🏝 by</span>
      <a
        href="https://seenovate.co.uk/?utm_source=VotePulse&utm_medium=footer&utm_campaign=customer"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jersey-red focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        style={{ color: "#C8922A" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#A31621";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#C8922A";
        }}
      >
        Seenovate
      </a>
    </div>
  );
}
