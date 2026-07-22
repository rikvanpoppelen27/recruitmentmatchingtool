import { describe, expect, it } from "vitest";

import { detectSource } from "../src/lib/sources/detect-source";

describe("detectSource", () => {
  it("herkent LinkedIn-URLs", () => {
    expect(detectSource("https://www.linkedin.com/jobs/view/12345")).toEqual({
      source: "LINKEDIN",
      label: "LinkedIn",
    });
  });

  it("herkent Indeed ongeacht de landen-TLD", () => {
    expect(detectSource("https://nl.indeed.com/vacature/456")).toEqual({ source: "INDEED", label: "Indeed" });
    expect(detectSource("https://www.indeed.co.uk/job/789")).toEqual({ source: "INDEED", label: "Indeed" });
  });

  it("herkent bekende Nederlandse vacaturesites met een eigen label", () => {
    expect(detectSource("https://www.nationalevacaturebank.nl/vacature/1")).toEqual({
      source: "OTHER",
      label: "Nationale Vacaturebank",
    });
    expect(detectSource("https://www.werkzoeken.nl/vacature/2")).toEqual({
      source: "OTHER",
      label: "Werkzoeken.nl",
    });
  });

  it("valt terug op 'other' voor een onbekend domein", () => {
    expect(detectSource("https://www.acme-recruitment.example/vacature")).toEqual({
      source: "OTHER",
      label: "Overig",
    });
  });

  it("geeft 'manual' als er geen URL is", () => {
    expect(detectSource(null)).toEqual({ source: "MANUAL", label: "Handmatig" });
    expect(detectSource(undefined)).toEqual({ source: "MANUAL", label: "Handmatig" });
    expect(detectSource("")).toEqual({ source: "MANUAL", label: "Handmatig" });
    expect(detectSource("   ")).toEqual({ source: "MANUAL", label: "Handmatig" });
  });

  it("behandelt een ongeldige URL-string als 'other' i.p.v. te crashen", () => {
    expect(detectSource("dit is geen url")).toEqual({ source: "OTHER", label: "Overig" });
  });
});
