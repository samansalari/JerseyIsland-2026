import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  href?: string;
  className?: string;
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
}: LogoProps) {
  const px = sizes[size];

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/votepulse-icon.svg"
        alt="VotePulse"
        width={px}
        height={px}
        className="flex-shrink-0"
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
          <span style={{ color: "#F5E8C8" }}>Vote</span>
          <span style={{ color: "#C8922A" }}>Pulse</span>
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
