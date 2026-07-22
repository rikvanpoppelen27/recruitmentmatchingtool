/**
 * Bureau-specifieke waarden voor het frontsheet-template (templates/frontsheet.html).
 * In fase 7 wordt dit per gebruiker instelbaar (zie `User.anonymizeCandidateInPdf`
 * in het Prisma-schema, dat hier alvast op vooruitloopt) — tot die tijd is dit
 * één centrale config.
 */

// Print-proof placeholder-logo als data-URI: geen extern bestand nodig, faalt
// nooit offline. Vervang `logoUrl` door een echt logo-pad/data-URI zodra de
// Morgan Black-huisstijl beschikbaar is.
const PLACEHOLDER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48">
  <text x="0" y="32" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1a1a1a">Morgan Black</text>
</svg>`;

export const branding = {
  companyName: "Morgan Black",
  logoUrl: `data:image/svg+xml;base64,${Buffer.from(PLACEHOLDER_LOGO_SVG).toString("base64")}`,
  primaryColor: "#1a1a1a",
  footerText: "Morgan Black — Recruitment & Selectie",

  /**
   * AVG: contactgegevens (e-mail/telefoon) uit het CV verwijderen vóór
   * samenvoegen met het frontsheet. Werkt betrouwbaar voor DOCX-bronnen
   * (tekst-vervanging vóór PDF-conversie). Voor CV's die al als PDF zijn
   * aangeleverd is betrouwbare tekst-redactie niet geïmplementeerd — zie
   * lib/pdf/merge.ts. Contactgegevens blijven in dat geval zichtbaar in het
   * bijgevoegde CV en er wordt een expliciete waarschuwing gegeven.
   */
  anonymizeCV: false,
} as const;
