import { Badge } from "@/components/ui/badge";

type VacancySourceLiteral = "ADZUNA" | "LINKEDIN" | "INDEED" | "MANUAL" | "OTHER";

const SOURCE_STYLES: Record<VacancySourceLiteral, { label: string; className: string }> = {
  ADZUNA: { label: "Adzuna", className: "bg-blue-100 text-blue-800" },
  LINKEDIN: { label: "LinkedIn", className: "bg-sky-100 text-sky-800" },
  INDEED: { label: "Indeed", className: "bg-indigo-100 text-indigo-800" },
  MANUAL: { label: "Handmatig", className: "bg-neutral-100 text-neutral-700" },
  OTHER: { label: "Overig", className: "bg-neutral-100 text-neutral-700" },
};

interface SourceBadgeProps {
  source: VacancySourceLiteral;
  sourceUrl?: string | null;
}

/** Gekleurde badge met bronnaam i.p.v. gedownloade merklogo's (zie fase 6B-spec). */
export function SourceBadge({ source, sourceUrl }: SourceBadgeProps) {
  const style = SOURCE_STYLES[source];
  return (
    <Badge className={style.className} title={sourceUrl ?? style.label}>
      {style.label}
    </Badge>
  );
}
