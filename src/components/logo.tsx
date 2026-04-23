"use client";

import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  href?: string;
  className?: string;
  wordmarkTheme?: "light" | "dark";
  blendMode?: "normal" | "lighten";
}

const sizes = {
  sm: 32,
  md: 40,
  lg: 56,
};

export function Logo({
  size = "md",
  showWordmark = true,
  href = "/",
  className = "",
  wordmarkTheme = "light",
  blendMode = wordmarkTheme === "light" ? "lighten" : "normal",
}: LogoProps) {
  const px = sizes[size];
  const wordmarkColors =
    wordmarkTheme === "dark"
      ? { vote: "#0D1B2A", pulse: "#A31621" }
      : { vote: "#F5E8C8", pulse: "#C8922A" };

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="flex-shrink-0 overflow-hidden rounded-xl shadow-sm"
        style={{ width: px, height: px }}
      >
        <Image
          src="/Logo__2_.png"
          alt="VotePulse"
          width={px}
          height={px}
          className={`h-full w-full object-cover ${
            blendMode === "lighten" ? "mix-blend-lighten" : ""
          }`}
          priority
        />
      </div>

      {showWordmark && (
        <span
          className="select-none font-bold leading-none tracking-tight"
          style={{
            fontSize: px * 0.5,
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
        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8922A]"
      >
        {content}
      </Link>
    );
  }

  return content;
}
