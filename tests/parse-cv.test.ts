import { describe, expect, it } from "vitest";

import { normalizePhone } from "../src/lib/cv/normalizePhone";
import { parsedCvSchema } from "../src/lib/validation/cv";

describe("normalizePhone", () => {
  it("normaliseert een 06-nummer naar E.164", () => {
    expect(normalizePhone("0612345678")).toEqual({ phone: "+31612345678", phoneRaw: null });
  });

  it("normaliseert +31 6 met spaties", () => {
    expect(normalizePhone("+31 6 12345678")).toEqual({ phone: "+31612345678", phoneRaw: null });
  });

  it("normaliseert 0031-notatie", () => {
    expect(normalizePhone("0031612345678")).toEqual({ phone: "+31612345678", phoneRaw: null });
  });

  it("normaliseert een nummer met streepjes en spaties", () => {
    expect(normalizePhone("06-12 34 56 78")).toEqual({ phone: "+31612345678", phoneRaw: null });
  });

  it("normaliseert een vast nummer (020...)", () => {
    expect(normalizePhone("020-1234567")).toEqual({ phone: "+31201234567", phoneRaw: null });
  });

  it("bewaart het ruwe nummer als normaliseren niet lukt en zet phone op null", () => {
    const result = normalizePhone("bel maar even");
    expect(result.phone).toBeNull();
    expect(result.phoneRaw).toBe("bel maar even");
  });

  it("geeft phone en phoneRaw beide null bij ontbrekend nummer", () => {
    expect(normalizePhone(null)).toEqual({ phone: null, phoneRaw: null });
  });
});

describe("parsedCvSchema", () => {
  const validExample = {
    fullName: "Jan Jansen",
    email: "jan@example.com",
    phone: "0612345678",
    region: "Amsterdam",
    skills: ["react", "typescript"],
    yearsExperience: 5,
    workExperience: [
      { jobTitle: "Front-end developer", employer: "Acme BV", period: "2019-2022", description: "React apps gebouwd" },
    ],
    educations: [
      { institution: "HvA", degree: "Bachelor", fieldOfStudy: "Informatica", startYear: 2015, endYear: 2019 },
    ],
    languages: ["nederlands", "engels"],
    availability: "per direct beschikbaar",
  };

  it("accepteert een volledig, geldig voorbeeld", () => {
    const result = parsedCvSchema.safeParse(validExample);
    expect(result.success).toBe(true);
  });

  it("accepteert null/lege-array voor ontbrekende velden (nooit verzonnen data verplicht)", () => {
    const result = parsedCvSchema.safeParse({
      fullName: null,
      email: null,
      phone: null,
      region: null,
      skills: [],
      yearsExperience: null,
      workExperience: [],
      educations: [],
      languages: [],
      availability: null,
    });
    expect(result.success).toBe(true);
  });

  it("verwerpt een ongeldig voorbeeld (verplicht veld ontbreekt, verkeerd type)", () => {
    const result = parsedCvSchema.safeParse({
      fullName: "Jan Jansen",
      email: null,
      phone: null,
      region: null,
      skills: "react, typescript", // moet een array zijn, geen string
      yearsExperience: null,
      workExperience: [],
      educations: [],
      languages: [],
      // "availability" ontbreekt
    });
    expect(result.success).toBe(false);
  });
});
