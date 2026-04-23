import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  href?: string;
  className?: string;
  wordmarkTheme?: "light" | "dark";
}

const sizes = {
  sm: 28,
  md: 36,
  lg: 48,
};

export function Logo({
  size = "md",
  showWordmark = true,
  href = "/",
  className = "",
  wordmarkTheme = "light",
}: LogoProps) {
  const px = sizes[size];
  const wordmarkColors =
    wordmarkTheme === "dark"
      ? { vote: "#0D1B2A", pulse: "#A31621" }
      : { vote: "#F5E8C8", pulse: "#C8922A" };

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/votepulse-icon.svg"
        alt="VotePulse"
        width={px}
        height={px}
        className="flex-shrink-0 rounded-xl shadow-sm"
        priority
      />

      {showWordmark && (
        <span
          className="font-bold leading-none tracking-tight"
          style={{
            fontSize: px * 0.55,
            fontFamily: "Archivo, sans-serif",
          }}
        >
          <span style={{ color: wordmarkColors.vote }}>Vote</span>
          <span style={{ color: wordmarkColors.pulse }}>Pulse</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {content}
      </Link>
    );
  }

  return content;
}
