import ReactMarkdown from "react-markdown";

export function ManifestoExpander({
  manifestoRaw,
  manifestoUrl,
}: {
  manifestoRaw: string;
  manifestoUrl: string | null;
}) {
  return (
    <details className="group mt-5">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg text-[13px] font-medium text-muted-foreground transition-colors hover:text-navy">
        <span className="transition-transform duration-200 group-open:rotate-90">
          ▶
        </span>
        View original manifesto text
      </summary>

      <div className="mt-4 rounded-2xl border border-border/80 bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Source: scraped from flow.je
          </span>

          {manifestoUrl && (
            <a
              href={manifestoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-jersey-red/20 bg-jersey-red/5 px-3 py-1.5 text-[12px] font-medium text-jersey-red transition-colors hover:border-jersey-red/35 hover:bg-jersey-red/10"
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
              View original page
            </a>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-surface/70 p-4">
          <div className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-navy prose-p:leading-7 prose-strong:text-navy prose-a:text-jersey-red prose-a:no-underline hover:prose-a:underline prose-blockquote:border-gold/40 prose-blockquote:text-muted-foreground prose-li:text-muted-foreground prose-table:text-[12px]">
            <ReactMarkdown>
              {manifestoRaw || "No manifesto text available."}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </details>
  );
}
