import { describe, expect, it } from "vitest";

import {
  buildDedupeKey,
  computeDedupeHash,
  dedupeAgainstExisting,
  dedupeWithinRun,
  normalize,
} from "../src/lib/dedupe";

describe("normalize", () => {
  it("verwijdert diakrieten en maakt lowercase", () => {
    expect(normalize("Café Employé")).toBe("cafe employe");
  });

  it("behandelt 'Frontend' en 'Front-end' gelijk", () => {
    expect(normalize("Frontend Developer")).toBe(normalize("Front-end Developer"));
    expect(normalize("Front-end Developer")).toBe("frontend developer");
  });

  it("behandelt 'B.V.' en 'BV' gelijk", () => {
    expect(normalize("Acme B.V.")).toBe(normalize("Acme BV"));
    expect(normalize("Acme B.V.")).toBe("acme bv");
  });

  it("voegt meervoudige spaties en overige leestekens samen", () => {
    expect(normalize("Acme   &   Co,  Inc.")).toBe("acme co inc");
  });
});

describe("buildDedupeKey / computeDedupeHash", () => {
  it("levert dezelfde hash op voor dezelfde vacature via twee jobboards met kleine schrijfverschillen", () => {
    const hashA = computeDedupeHash("Acme B.V.", "Front-end Developer", "Amsterdam");
    const hashB = computeDedupeHash("Acme BV", "Frontend Developer", "Amsterdam");
    expect(hashA).toBe(hashB);
  });

  it("levert een andere hash op voor een andere plaats", () => {
    const hashAmsterdam = computeDedupeHash("Acme BV", "Frontend Developer", "Amsterdam");
    const hashRotterdam = computeDedupeHash("Acme BV", "Frontend Developer", "Rotterdam");
    expect(hashAmsterdam).not.toBe(hashRotterdam);
  });

  it("bouwt een leesbare sleutel op van de drie genormaliseerde velden", () => {
    expect(buildDedupeKey("Acme B.V.", "Front-end Developer", "Amsterdam")).toBe(
      "acme bv|frontend developer|amsterdam",
    );
  });
});

describe("dedupeWithinRun", () => {
  const base = { companyName: "Acme BV", title: "Frontend Developer", location: "Amsterdam" };

  it("houdt het eerste voorkomen en telt de rest als duplicaat", () => {
    const items = [
      { ...base, id: "adzuna-1" },
      { ...base, id: "jobboard-2", companyName: "Acme B.V.", title: "Front-end Developer" },
      { companyName: "Other BV", title: "Backend Developer", location: "Utrecht", id: "adzuna-3" },
    ];

    const result = dedupeWithinRun(items);

    expect(result.unique).toHaveLength(2);
    expect(result.duplicatesWithinRun).toBe(1);

    const ids = result.unique.map((v) => v.id);
    // De eerst geziene vacature blijft behouden, de latere duplicaat (via het
    // tweede jobboard, met net andere schrijfwijze) niet.
    expect(ids).toContain("adzuna-1");
    expect(ids).not.toContain("jobboard-2");
  });

  it("geeft geen duplicaten terug als alle vacatures uniek zijn", () => {
    const items = [
      { ...base },
      { companyName: "Other BV", title: "Backend Developer", location: "Utrecht" },
    ];

    const result = dedupeWithinRun(items);

    expect(result.unique).toHaveLength(2);
    expect(result.duplicatesWithinRun).toBe(0);
  });
});

describe("dedupeAgainstExisting", () => {
  it("splitst in nieuw op te slaan en al bekende (te 'touchen') vacatures", () => {
    const items = [
      { dedupeHash: "hash-1", title: "Frontend Developer" },
      { dedupeHash: "hash-2", title: "Backend Developer" },
    ];
    const existingHashes = new Set(["hash-1"]);

    const result = dedupeAgainstExisting(items, existingHashes);

    expect(result.toTouch).toEqual([{ dedupeHash: "hash-1", title: "Frontend Developer" }]);
    expect(result.toInsert).toEqual([{ dedupeHash: "hash-2", title: "Backend Developer" }]);
  });
});
