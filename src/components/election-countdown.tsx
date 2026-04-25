"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

// Election day: June 7, 2026 08:00 AM Jersey time (Europe/London).
const ELECTION_DATE = new Date("2026-06-07T08:00:00+01:00");
const COUNTDOWN_FONT = "Archivo, sans-serif";
const COUNTDOWN_TEXT_COLOR = "#F5E8C8";
const COUNTDOWN_ACCENT_COLOR = "#C8922A";
const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

type TimeLeftUnit = "days" | "hours" | "minutes" | "seconds";

const COUNTDOWN_UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
] as const satisfies ReadonlyArray<{ key: TimeLeftUnit; label: string }>;

function getTimeLeft(): TimeLeft {
  const now = new Date();
  const total = ELECTION_DATE.getTime() - now.getTime();

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const seconds = Math.floor((total / SECOND) % 60);
  const minutes = Math.floor((total / MINUTE) % 60);
  const hours = Math.floor((total / HOUR) % 24);
  const days = Math.floor(total / DAY);

  return { days, hours, minutes, seconds, total };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

interface CountUnitProps {
  value: number;
  label: string;
  showColon?: boolean;
}

function CountUnit({
  value,
  label,
  showColon = true,
}: CountUnitProps): ReactElement {
  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <div className="flex flex-col items-center">
        <div
          className="font-bold tabular-nums leading-none"
          style={{
            fontFamily: COUNTDOWN_FONT,
            color: COUNTDOWN_TEXT_COLOR,
            fontSize: "clamp(1.45rem, 5vw, 3.5rem)",
            minWidth: "2ch",
            textAlign: "center",
          }}
        >
          {pad(value)}
        </div>
        <div
          className="mt-1 text-center uppercase tracking-widest"
          style={{
            fontFamily: COUNTDOWN_FONT,
            color: "rgba(245, 232, 200, 0.55)",
            fontSize: "clamp(0.48rem, 1.2vw, 0.7rem)",
            letterSpacing: "0.15em",
          }}
        >
          {label}
        </div>
      </div>

      {showColon && (
        <div
          className="select-none pb-5 font-bold"
          style={{
            color: COUNTDOWN_ACCENT_COLOR,
            fontSize: "clamp(1.05rem, 4vw, 2.5rem)",
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          :
        </div>
      )}
    </div>
  );
}

export function ElectionCountdown(): ReactElement {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(getTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted || !timeLeft) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="mb-2 text-xs uppercase tracking-widest"
          style={{
            color: "rgba(245, 232, 200, 0.55)",
            fontFamily: COUNTDOWN_FONT,
          }}
        >
          Election Day
        </div>
        <div className="flex items-center gap-2 opacity-40">
          {COUNTDOWN_UNITS.map((unit, index) => (
            <span
              key={unit.key}
              className="font-bold tabular-nums"
              style={{
                color: COUNTDOWN_TEXT_COLOR,
                fontFamily: COUNTDOWN_FONT,
                fontSize: "clamp(1.45rem, 5vw, 3.5rem)",
                minWidth: "2ch",
                textAlign: "center",
              }}
            >
              --
              {index < COUNTDOWN_UNITS.length - 1 ? ":" : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (timeLeft.total <= 0) {
    return (
      <div
        className="text-center font-bold"
        style={{
          color: COUNTDOWN_ACCENT_COLOR,
          fontFamily: COUNTDOWN_FONT,
          fontSize: "1.5rem",
        }}
      >
        Election Day is today!
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p
        className="mb-4 text-center uppercase tracking-widest"
        style={{
          fontFamily: COUNTDOWN_FONT,
          color: "rgba(245, 232, 200, 0.55)",
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
        }}
      >
        ● Election Day — 7 June 2026
      </p>

      <div
        className="flex max-w-full items-start rounded-xl px-3 py-4 sm:px-5"
        style={{
          border: "1px solid rgba(245, 232, 200, 0.08)",
          backdropFilter: "blur(8px)",
          background: "rgba(13, 27, 42, 0.4)",
        }}
      >
        {COUNTDOWN_UNITS.map((unit, index) => (
          <CountUnit
            key={unit.key}
            value={timeLeft[unit.key]}
            label={unit.label}
            showColon={index < COUNTDOWN_UNITS.length - 1}
          />
        ))}
      </div>

      <p
        className="mt-3 text-center"
        style={{
          fontFamily: COUNTDOWN_FONT,
          color: "rgba(245, 232, 200, 0.35)",
          fontSize: "0.6rem",
          letterSpacing: "0.05em",
        }}
      >
        Polls open 8:00 AM · Jersey Standard Time
      </p>
    </div>
  );
}
