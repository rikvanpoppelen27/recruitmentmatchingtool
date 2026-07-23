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
      <body className="min-h-screen bg-background text-ink antialiased">
        <header className="border-b border-neutral-100 bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
            <span className="text-sm font-semibold tracking-tight text-ink">Recruitmenttool</span>
            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
