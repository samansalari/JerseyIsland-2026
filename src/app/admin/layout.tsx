import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Admin — VotePulse" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-neutral-50 text-black">{children}</div>;
}
