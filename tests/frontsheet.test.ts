import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { truncateWords } from "../src/lib/ai/frontsheet";
import { mergeFrontsheetWithCv } from "../src/lib/pdf/merge";
import { renderFrontsheetHtml, renderListItems, type FrontsheetTemplateData } from "../src/lib/pdf/template";

const TEST_TEMPLATE = `<html><body>
<header><img src="{{logoUrl}}" alt="{{companyName}}" /></header>
<h1>{{candidateName}}</h1>
<p>{{vacancyTitle}} bij {{vacancyCompany}}</p>
<p>{{summary}}</p>
<p>{{whyThisMatch}}</p>
<ul>{{experienceBulletsHtml}}</ul>
<ul>{{skillsHtml}}</ul>
<ul>{{educationHtml}}</ul>
<p>{{languages}}</p>
<p>{{availability}}</p>
<footer style="color: {{primaryColor}}">{{footerText}}</footer>
</body></html>`;

function fullData(overrides: Partial<FrontsheetTemplateData> = {}): FrontsheetTemplateData {
  return {
    logoUrl: "data:image/svg+xml;base64,abc",
    companyName: "Morgan Black",
    primaryColor: "#111111",
    candidateName: "Jan Jansen",
    vacancyTitle: "Front-end Developer",
    vacancyCompany: "Acme BV",
    summary: "Een samenvatting.",
    whyThisMatch: "Omdat de skills matchen.",
    experienceBullets: ["React-ervaring bij Acme", "TypeScript-project bij Beta"],
    skills: ["react", "typescript"],
    education: ["HBO Informatica, HvA"],
    languages: "Nederlands, Engels",
    availability: "Per direct",
    footerText: "Morgan Black — Recruitment",
    ...overrides,
  };
}

describe("renderFrontsheetHtml (template-invulling)", () => {
  it("laat geen onvervangen {{...}}-placeholders over bij volledige data", () => {
    const html = renderFrontsheetHtml(TEST_TEMPLATE, fullData());
    expect(html).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it("verwerkt de kandidaatnaam en vacaturetitel correct in de output", () => {
    const html = renderFrontsheetHtml(TEST_TEMPLATE, fullData());
    expect(html).toContain("Jan Jansen");
    expect(html).toContain("Front-end Developer bij Acme BV");
  });

  it("escaped HTML-gevoelige tekens in vrije tekst (geen HTML-injectie)", () => {
    const html = renderFrontsheetHtml(TEST_TEMPLATE, fullData({ summary: "R&D <script>alert(1)</script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("gooit een fout als het template een placeholder bevat die niet wordt aangeleverd", () => {
    expect(() => renderFrontsheetHtml("<p>{{onbekendVeld}}</p>", fullData())).toThrow(/Onvervangen placeholders/);
  });
});

describe("renderListItems", () => {
  it("toont een fallback-item bij een lege lijst (geen lege <ul></ul>)", () => {
    expect(renderListItems([])).toBe("<li>Niet vermeld</li>");
  });

  it("rendert elk item als los, geëscaped <li>-element", () => {
    expect(renderListItems(["react", "typescript"])).toBe("<li>react</li><li>typescript</li>");
  });
});

describe("truncateWords (lengtebegrenzing)", () => {
  it("laat tekst onder de limiet ongewijzigd", () => {
    expect(truncateWords("een korte zin", 10)).toBe("een korte zin");
  });

  it("knipt tekst boven de limiet af en voegt een ellipsis toe", () => {
    const longText = Array.from({ length: 200 }, (_, i) => `woord${i}`).join(" ");
    const result = truncateWords(longText, 120);
    expect(result.split(/\s+/)).toHaveLength(120);
    expect(result.endsWith("…")).toBe(true);
  });

  it("telt exact op de limiet als nog steeds ongewijzigd", () => {
    const exact = Array.from({ length: 5 }, (_, i) => `w${i}`).join(" ");
    expect(truncateWords(exact, 5)).toBe(exact);
  });
});

describe("mergeFrontsheetWithCv (merge-volgorde)", () => {
  async function makePdf(pageCount: number, size: [number, number]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage(size);
    }
    return Buffer.from(await doc.save());
  }

  it("plaatst de frontsheet-pagina's vóór de CV-pagina's, in de juiste volgorde", async () => {
    const frontsheetPdf = await makePdf(2, [300, 300]);
    const cvPdf = await makePdf(3, [400, 500]);

    const { buffer, pageCount } = await mergeFrontsheetWithCv(frontsheetPdf, cvPdf);
    expect(pageCount).toBe(5);

    const merged = await PDFDocument.load(buffer);
    expect(merged.getPageCount()).toBe(5);

    // Eerste 2 pagina's hebben de afmetingen van de frontsheet, de laatste 3 die van het CV.
    for (let i = 0; i < 2; i++) {
      const { width, height } = merged.getPage(i).getSize();
      expect([width, height]).toEqual([300, 300]);
    }
    for (let i = 2; i < 5; i++) {
      const { width, height } = merged.getPage(i).getSize();
      expect([width, height]).toEqual([400, 500]);
    }
  });

  it("werkt ook met een 1-pagina-frontsheet en 1-pagina-CV", async () => {
    const frontsheetPdf = await makePdf(1, [210, 297]);
    const cvPdf = await makePdf(1, [612, 792]);

    const { pageCount } = await mergeFrontsheetWithCv(frontsheetPdf, cvPdf);
    expect(pageCount).toBe(2);
  });
});
