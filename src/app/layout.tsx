import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Recruitmenttool",
  description: "Interne werktool voor vacature-import, CV-parsing, matching, frontsheets en mailconcepten.",
};

const NAV_ITEMS = [
  { href: "/", label: "Overzicht" },
  { href: "/vacatures", label: "Vacatures" },
  { href: "/zoekprofielen", label: "Zoekprofielen" },
  { href: "/kandidaten", label: "Kandidaten" },
  { href: "/matches", label: "Matches" },
  { href: "/instellingen", label: "Instellingen" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <span className="text-sm font-semibold text-neutral-900">Recruitmenttool</span>
            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
