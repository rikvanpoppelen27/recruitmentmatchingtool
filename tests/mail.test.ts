import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findContactInfo,
  importExampleEmails,
  maskContactInfo,
  parseExampleEmail,
} from "../src/lib/mail/import-examples";
import { makeBouwStijlprofielResultSchema, mailContentSchema, styleProfileContentSchema } from "../src/lib/validation/mail";

describe("parseExampleEmail", () => {
  it("extraheert de onderwerpsregel als de eerste regel met 'Onderwerp:' begint", () => {
    const result = parseExampleEmail("mail1.txt", "Onderwerp: Voorstel kandidaat\n\nHoi Jan,\n\nTekst hier.");
    expect(result.subject).toBe("Voorstel kandidaat");
    expect(result.body).toBe("Hoi Jan,\n\nTekst hier.");
  });

  it("geeft subject null als de eerste regel niet met 'Onderwerp:' begint", () => {
    const result = parseExampleEmail("mail2.txt", "Hoi Jan,\n\nTekst zonder onderwerpsregel.");
    expect(result.subject).toBeNull();
    expect(result.body).toBe("Hoi Jan,\n\nTekst zonder onderwerpsregel.");
  });

  it("is niet hoofdlettergevoelig voor 'Onderwerp:'", () => {
    const result = parseExampleEmail("mail3.txt", "onderwerp: Test\n\nBody.");
    expect(result.subject).toBe("Test");
  });
});

describe("findContactInfo / maskContactInfo", () => {
  it("vindt een e-mailadres in tekst", () => {
    const findings = findContactInfo("mail.txt", "Bereikbaar via rik@morganblack.nl voor vragen.");
    expect(findings).toEqual([{ fileName: "mail.txt", type: "email", value: "rik@morganblack.nl" }]);
  });

  it("vindt een Nederlands mobiel nummer", () => {
    const findings = findContactInfo("mail.txt", "Bel me op 06-12345678 als het uitkomt.");
    expect(findings).toEqual([{ fileName: "mail.txt", type: "telefoonnummer", value: "06-12345678" }]);
  });

  it("vindt een Nederlands vast nummer", () => {
    const findings = findContactInfo("mail.txt", "Kantoor: 020-1234567.");
    expect(findings).toEqual([{ fileName: "mail.txt", type: "telefoonnummer", value: "020-1234567" }]);
  });

  it("vindt niets in tekst zonder contactgegevens", () => {
    expect(findContactInfo("mail.txt", "Gewoon een zin zonder iets geks.")).toEqual([]);
  });

  it("maskeert e-mailadres en telefoonnummer in de tekst", () => {
    const masked = maskContactInfo("Bel 06-12345678 of mail rik@morganblack.nl.");
    expect(masked).toBe("Bel [GEMASKEERD] of mail [GEMASKEERD].");
  });
});

describe("importExampleEmails", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "mail-examples-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("waarschuwt als er minder dan 5 voorbeelden zijn", async () => {
    await writeFile(path.join(dir, "01.txt"), "Onderwerp: Test 1\n\nBody 1.");
    await writeFile(path.join(dir, "02.txt"), "Onderwerp: Test 2\n\nBody 2.");

    const result = await importExampleEmails(dir);
    expect(result.examples).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes("Slechts 2 voorbeeldmail"))).toBe(true);
  });

  it("geeft geen <5-waarschuwing bij 5 of meer voorbeelden", async () => {
    for (let i = 1; i <= 5; i++) {
      await writeFile(path.join(dir, `${i}.txt`), `Onderwerp: Test ${i}\n\nBody ${i}.`);
    }

    const result = await importExampleEmails(dir);
    expect(result.examples).toHaveLength(5);
    expect(result.warnings.some((w) => w.includes("Slechts"))).toBe(false);
  });

  it("waarschuwt bij gevonden contactgegevens en maskeert ze pas als maskContactInfo is gezet", async () => {
    await writeFile(path.join(dir, "01.txt"), "Onderwerp: Test\n\nBel 06-12345678 voor meer info.");

    const unmasked = await importExampleEmails(dir);
    expect(unmasked.contactInfoFindings).toHaveLength(1);
    expect(unmasked.examples[0].body).toContain("06-12345678");
    expect(unmasked.warnings.some((w) => w.includes("persoonsgegeven"))).toBe(true);

    const masked = await importExampleEmails(dir, { maskContactInfo: true });
    expect(masked.examples[0].body).toContain("[GEMASKEERD]");
    expect(masked.examples[0].body).not.toContain("06-12345678");
  });

  it("negeert bestanden die geen .txt of .md zijn", async () => {
    await writeFile(path.join(dir, "01.txt"), "Onderwerp: Test\n\nBody.");
    await writeFile(path.join(dir, "notes.json"), "{}");

    const result = await importExampleEmails(dir);
    expect(result.examples).toHaveLength(1);
  });
});

describe("styleProfileContentSchema", () => {
  const valid = {
    aanhef: "Informeel, met voornaam ('Hoi Jan,')",
    toon: "Zakelijk maar toegankelijk, geen jargon.",
    zinslengte: "kort" as const,
    structuur: "Haakje -> kandidaat introduceren -> waarom relevant -> call to action",
    introductiestijlKandidaat: "Noemt eerst de belangrijkste skill, dan relevante ervaring.",
    afsluiting: "Vraagt om een moment voor een belletje.",
    typischeFormuleringen: ["Ik denk dat", "sluit goed aan bij", "graag voorstellen"],
    vermijden: ["geen emoji", "geen superlatieven"],
    onderwerpsregelPatroon: "Voorstel: <functie> voor <bedrijf>",
  };

  it("accepteert een volledig, geldig profiel", () => {
    expect(styleProfileContentSchema.safeParse(valid).success).toBe(true);
  });

  it("verwerpt een ongeldige zinslengte-waarde", () => {
    const result = styleProfileContentSchema.safeParse({ ...valid, zinslengte: "heel lang" });
    expect(result.success).toBe(false);
  });

  it("verwerpt een profiel met ontbrekend verplicht veld", () => {
    const { afsluiting: _afsluiting, ...withoutAfsluiting } = valid;
    expect(styleProfileContentSchema.safeParse(withoutAfsluiting).success).toBe(false);
  });
});

describe("makeBouwStijlprofielResultSchema", () => {
  const base = {
    aanhef: "Informeel",
    toon: "Toegankelijk",
    zinslengte: "kort" as const,
    structuur: "Intro -> kandidaat -> match -> CTA",
    introductiestijlKandidaat: "Skill eerst",
    afsluiting: "Vraagt om een belletje",
    typischeFormuleringen: ["sluit goed aan"],
    vermijden: ["geen emoji"],
    onderwerpsregelPatroon: "Voorstel: <functie>",
  };

  it("accepteert 3 unieke, geldige indices binnen bereik", () => {
    const schema = makeBouwStijlprofielResultSchema(5);
    const result = schema.safeParse({ ...base, meestRepresentatieveVoorbeelden: [1, 3, 5] });
    expect(result.success).toBe(true);
  });

  it("verwerpt een index buiten bereik", () => {
    const schema = makeBouwStijlprofielResultSchema(3);
    const result = schema.safeParse({ ...base, meestRepresentatieveVoorbeelden: [1, 2, 4] });
    expect(result.success).toBe(false);
  });

  it("verwerpt dubbele indices", () => {
    const schema = makeBouwStijlprofielResultSchema(5);
    const result = schema.safeParse({ ...base, meestRepresentatieveVoorbeelden: [1, 1, 2] });
    expect(result.success).toBe(false);
  });

  it("verwerpt een lijst met een ander aantal dan 3", () => {
    const schema = makeBouwStijlprofielResultSchema(5);
    const result = schema.safeParse({ ...base, meestRepresentatieveVoorbeelden: [1, 2] });
    expect(result.success).toBe(false);
  });
});

describe("mailContentSchema", () => {
  it("accepteert een geldig onderwerp + body", () => {
    expect(mailContentSchema.safeParse({ subject: "Voorstel: Front-end Developer", body: "Hoi Jan, ..." }).success).toBe(
      true,
    );
  });

  it("verwerpt een lege body", () => {
    expect(mailContentSchema.safeParse({ subject: "Onderwerp", body: "" }).success).toBe(false);
  });

  it("verwerpt een ontbrekend onderwerp", () => {
    expect(mailContentSchema.safeParse({ body: "Tekst zonder onderwerp" }).success).toBe(false);
  });
});
