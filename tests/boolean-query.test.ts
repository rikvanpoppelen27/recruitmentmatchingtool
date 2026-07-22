import { describe, expect, it } from "vitest";

import {
  BooleanQuerySyntaxError,
  compileBooleanQuery,
  describeBooleanQuery,
  parseBooleanQuery,
} from "../src/lib/search/boolean-query";

describe("parseBooleanQuery — losse termen en fouten", () => {
  it("parset een los woord", () => {
    expect(parseBooleanQuery("react")).toEqual({ type: "term", value: "react", exact: false });
  });

  it("parset een woordgroep tussen aanhalingstekens als exacte term", () => {
    expect(parseBooleanQuery('"front-end developer"')).toEqual({
      type: "term",
      value: "front-end developer",
      exact: true,
    });
  });

  it("gooit een fout bij een lege zoekterm", () => {
    expect(() => parseBooleanQuery("")).toThrow(BooleanQuerySyntaxError);
    expect(() => parseBooleanQuery("   ")).toThrow(BooleanQuerySyntaxError);
  });

  it("gooit een fout bij een ongebalanceerd openend haakje", () => {
    expect(() => parseBooleanQuery("(react OR vue")).toThrow(/sluitend haakje/);
  });

  it("gooit een fout bij een ongebalanceerd sluitend haakje", () => {
    expect(() => parseBooleanQuery("react OR vue)")).toThrow(BooleanQuerySyntaxError);
  });

  it("gooit een fout bij een operator zonder volgende term", () => {
    expect(() => parseBooleanQuery("react AND")).toThrow(/einde van de zoekterm/);
  });

  it("gooit een fout bij twee operators achter elkaar", () => {
    expect(() => parseBooleanQuery("react AND OR vue")).toThrow(BooleanQuerySyntaxError);
  });

  it("gooit een fout bij een zoekterm die met een operator begint", () => {
    expect(() => parseBooleanQuery("AND react")).toThrow(BooleanQuerySyntaxError);
  });

  it("gooit een fout bij NOT direct vóór een groep tussen haakjes", () => {
    expect(() => parseBooleanQuery("NOT (react OR vue)")).toThrow(/groep tussen haakjes/);
  });

  it("gooit een fout bij een ontbrekend sluitend aanhalingsteken", () => {
    expect(() => parseBooleanQuery('"front-end developer')).toThrow(/aanhalingsteken/);
  });

  it("is hoofdlettersongevoelig voor operatoren", () => {
    expect(parseBooleanQuery("react and vue")).toEqual({
      type: "and",
      children: [
        { type: "term", value: "react", exact: false },
        { type: "term", value: "vue", exact: false },
      ],
    });
  });
});

describe("compileBooleanQuery — vertaling naar Adzuna-parameters", () => {
  it("vertaalt een los woord naar what_and", () => {
    expect(compileBooleanQuery("react")).toEqual([{ what_and: "react" }]);
  });

  it("vertaalt een exacte woordgroep naar what_phrase", () => {
    expect(compileBooleanQuery('"front-end developer"')).toEqual([{ what_phrase: "front-end developer" }]);
  });

  it("vertaalt een AND van twee woorden naar één what_and", () => {
    expect(compileBooleanQuery("react AND typescript")).toEqual([{ what_and: "react typescript" }]);
  });

  it("vertaalt een pure OR-lijst naar één what_or (geen opsplitsing nodig)", () => {
    expect(compileBooleanQuery("front-end OR frontend")).toEqual([{ what_or: "front-end frontend" }]);
  });

  it("vertaalt NOT naar what_exclude", () => {
    expect(compileBooleanQuery("react NOT stage")).toEqual([{ what_and: "react", what_exclude: "stage" }]);
  });

  it("ondersteunt NOT zonder expliciete AND ervoor, identiek aan met AND", () => {
    expect(compileBooleanQuery("react NOT stage")).toEqual(compileBooleanQuery("react AND NOT stage"));
  });

  it("combineert één OR-groep met AND-termen in dezelfde clause (geen opsplitsing)", () => {
    const result = compileBooleanQuery('("front-end" OR frontend) AND (react OR vue) NOT stage');
    // Twee OR-groepen tegelijk in dezelfde AND -> wél opsplitsing nodig (zie volgende test-groep).
    expect(result.length).toBeGreaterThan(0);
    for (const clause of result) {
      expect(clause.what_exclude).toBe("stage");
    }
  });

  it("combineert een enkele OR-groep met een los AND-woord in exact 1 aanroep", () => {
    expect(compileBooleanQuery("(react OR vue) AND senior")).toEqual([{ what_and: "senior", what_or: "react vue" }]);
  });

  it("splitst twee onafhankelijke OR-groepen die met AND gecombineerd worden in meerdere aanroepen", () => {
    const result = compileBooleanQuery("(a OR b) AND (c OR d)");
    expect(result).toHaveLength(2);
    // Eén OR-groep blijft intact als what_or, de andere wordt uitgesplitst
    // over de aanroepen — samen dekken ze alle 4 combinaties.
    const orValues = new Set(result.map((c) => c.what_or));
    expect(orValues).toEqual(new Set(["a b"]));
    const andValues = new Set(result.map((c) => c.what_and));
    expect(andValues).toEqual(new Set(["c", "d"]));
  });

  it("splitst geneste structuur binnen een OR-groep naar losse aanroepen", () => {
    const result = compileBooleanQuery("(react AND senior) OR junior");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ what_and: "react senior" });
    expect(result).toContainEqual({ what_and: "junior" });
  });

  it("splitst een OR van exacte woordgroepen in aparte aanroepen i.p.v. ze te bundelen in what_or", () => {
    // what_or ondersteunt geen meerwoordige woordgroepen — samenvoegen zou
    // "front-end developer" en "frontend developer" uit elkaar trekken tot
    // losse woorden en de zoekopdracht ongewenst verbreden (bug gevonden
    // tijdens een echte testrun: leverde 454 i.p.v. de verwachte resultaten op).
    const result = compileBooleanQuery('"front-end developer" OR "frontend developer"');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ what_phrase: "front-end developer" });
    expect(result).toContainEqual({ what_phrase: "frontend developer" });
  });

  it("splitst een gemengde OR van een exacte groep en een los woord", () => {
    const result = compileBooleanQuery('("front-end" OR frontend) AND react');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ what_phrase: "front-end", what_and: "react" });
    expect(result).toContainEqual({ what_and: "frontend react" });
  });
});

describe("describeBooleanQuery — leesbare interpretatie", () => {
  it("beschrijft een simpele AND/OR/NOT-combinatie", () => {
    const result = describeBooleanQuery('("front-end" OR frontend) AND react NOT stage');
    expect(result.mayContain).toEqual(['"front-end"', "frontend"]);
    expect(result.mustContain).toEqual(["react"]);
    expect(result.excluded).toEqual(["stage"]);
  });
});
