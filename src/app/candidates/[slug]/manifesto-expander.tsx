"use client";

import { useState } from "react";

/**
 * Expandable "View original manifesto" section.
 * Client component because it manages toggle state.
 */
export function ManifestoExpander({
  manifestoRaw,
  manifestoUrl,
}: {
  manifestoRaw: string;
  manifestoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-navy"
      >
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        {open ? "Hide original manifesto" : "View original manifesto"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-border bg-white p-5">
          {manifestoUrl && (
            <a
              href={manifestoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-jersey-red hover:underline"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M6 10l4-4" />
                <path d="M9 4.5h2.5V7" />
                <rect x="2" y="6" width="7" height="7" rx="1.5" />
              </svg>
              View original source
            </a>
          )}
          <blockquote className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
            {manifestoRaw}
          </blockquote>
        </div>
      )}
    </div>
  );
}
