"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkItem {
  href: string;
  label: string;
}

export function NavLinks({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const isActive = pathname === href;
        const isCompare = href === "/compare";

        if (isCompare) {
          return (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center rounded-md bg-[#A31621] px-4 py-2 text-[13px] font-semibold text-[#F5E8C8] transition-colors hover:bg-[#6B1414]"
            >
              {label}
            </Link>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
              isActive
                ? "font-semibold text-[#A31621]"
                : "font-medium text-[#0D1B2A] hover:text-[#A31621]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
