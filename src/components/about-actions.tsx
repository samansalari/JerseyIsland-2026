"use client";

export function ContactButton() {
  return (
    <a
      href="mailto:hello@votepulse.je"
      className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A31621] focus-visible:ring-offset-2"
      style={{ backgroundColor: "#A31621", color: "#F5E8C8" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#6B1414";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#A31621";
      }}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      hello@votepulse.je
    </a>
  );
}

export function BuyMeABeerButton() {
  return (
    <a
      href="https://www.buymeacoffee.com/samansalari"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 rounded-xl py-3 pl-5 pr-5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8922A] focus-visible:ring-offset-2"
      style={{ backgroundColor: "#C8922A", color: "#0D1B2A" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#A87823";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#C8922A";
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M4 2h12a1 1 0 0 1 1 1v.5h2.5A1.5 1.5 0 0 1 21 5v5a1.5 1.5 0 0 1-1.5 1.5H17V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V3a1 1 0 0 1 1-1zm11 9.5V4H5v13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-5.5zM17 10h1.5a.5.5 0 0 0 .5-.5V5a.5.5 0 0 0-.5-.5H17v5.5z" />
      </svg>
      Buy me a beer 🍺
    </a>
  );
}

export function RemovalButton() {
  return (
    <a
      href="mailto:hello@votepulse.je?subject=Information%20correction%20request"
      className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A31621] focus-visible:ring-offset-2"
      style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      hello@votepulse.je
    </a>
  );
}
