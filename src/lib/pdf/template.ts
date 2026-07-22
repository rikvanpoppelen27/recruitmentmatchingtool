import { readFile } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_PATH = path.join(__dirname, "..", "..", "..", "templates", "frontsheet.html");

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Rendert een lijst als kant-en-klare `<li>`-items (HTML-geëscaped). */
export function renderListItems(items: string[], emptyLabel = "Niet vermeld"): string {
  if (items.length === 0) return `<li>${escapeHtml(emptyLabel)}</li>`;
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export interface FrontsheetTemplateData {
  logoUrl: string;
  companyName: string;
  primaryColor: string;
  candidateName: string;
  vacancyTitle: string;
  vacancyCompany: string;
  summary: string;
  whyThisMatch: string;
  experienceBullets: string[];
  skills: string[];
  education: string[];
  languages: string;
  availability: string;
  footerText: string;
}

/**
 * Vult templates/frontsheet.html met de aangeleverde data. Gooit een fout als
 * er na vervanging nog onvervangen `{{...}}`-placeholders overblijven — dat
 * zou wijzen op een ontbrekend datapunt of een typefout in het template.
 */
export function renderFrontsheetHtml(template: string, data: FrontsheetTemplateData): string {
  const replacements: Record<string, string> = {
    logoUrl: data.logoUrl,
    companyName: escapeHtml(data.companyName),
    primaryColor: data.primaryColor,
    candidateName: escapeHtml(data.candidateName),
    vacancyTitle: escapeHtml(data.vacancyTitle),
    vacancyCompany: escapeHtml(data.vacancyCompany),
    summary: escapeHtml(data.summary),
    whyThisMatch: escapeHtml(data.whyThisMatch),
    experienceBulletsHtml: renderListItems(data.experienceBullets),
    skillsHtml: renderListItems(data.skills),
    educationHtml: renderListItems(data.education),
    languages: escapeHtml(data.languages),
    availability: escapeHtml(data.availability),
    footerText: escapeHtml(data.footerText),
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  const remaining = html.match(/\{\{[^}]+\}\}/g);
  if (remaining) {
    throw new Error(`Onvervangen placeholders in frontsheet-template: ${remaining.join(", ")}`);
  }

  return html;
}

export async function loadFrontsheetTemplate(): Promise<string> {
  return readFile(TEMPLATE_PATH, "utf-8");
}
