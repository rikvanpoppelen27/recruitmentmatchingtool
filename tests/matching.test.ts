import { describe, expect, it } from "vitest";

import { canonicalizeSkill } from "../src/config/skill-aliases";
import { matchConfig } from "../src/config/match";
import { combineScores, computeSkillScore, shouldCallSemanticLayer } from "../src/lib/match/score";
import { matchSkills } from "../src/lib/match/skills";

describe("canonicalizeSkill (normalisatie + alias-matching)", () => {
  it("maakt lowercase", () => {
    expect(canonicalizeSkill("React")).toBe("react");
  });

  it("normaliseert bekende aliassen naar dezelfde canonieke naam", () => {
    expect(canonicalizeSkill("React.js")).toBe("react");
    expect(canonicalizeSkill("ReactJS")).toBe("react");
    expect(canonicalizeSkill("js")).toBe("javascript");
    expect(canonicalizeSkill("TS")).toBe("typescript");
  });

  it("laat onbekende skills ongewijzigd (behalve lowercase)", () => {
    expect(canonicalizeSkill("Figma")).toBe("figma");
  });
});

describe("matchSkills (laag 1, deterministisch)", () => {
  it("volledige match: alle must-haves en nice-to-haves aanwezig", () => {
    const result = matchSkills(["react", "typescript", "css"], ["react", "typescript"], ["css"]);
    expect(result.mustHaveCoverage).toBe(1);
    expect(result.niceToHaveCoverage).toBe(1);
    expect(result.hasAllMustHaves).toBe(true);
    expect(result.missingMustHaves).toEqual([]);
  });

  it("herkent aliassen als match (react.js kandidaat vs react must-have)", () => {
    const result = matchSkills(["react.js", "js"], ["react"], ["javascript"]);
    expect(result.mustHaveCoverage).toBe(1);
    expect(result.niceToHaveCoverage).toBe(1);
  });

  it("gedeeltelijke match: één van de twee must-haves aanwezig", () => {
    const result = matchSkills(["react"], ["react", "typescript"], []);
    expect(result.mustHaveCoverage).toBe(0.5);
    expect(result.hasAllMustHaves).toBe(false);
    expect(result.missingMustHaves).toEqual(["typescript"]);
  });

  it("ontbrekende must-have skill: hasAllMustHaves false, ondanks overige matches", () => {
    const result = matchSkills(["css", "html"], ["react"], ["css", "html"]);
    expect(result.hasAllMustHaves).toBe(false);
    expect(result.mustHaveCoverage).toBe(0);
    expect(result.niceToHaveCoverage).toBe(1);
  });

  it("lege must-have/nice-to-have-lijsten tellen als volledige dekking (niets te missen)", () => {
    const result = matchSkills(["react"], [], []);
    expect(result.mustHaveCoverage).toBe(1);
    expect(result.niceToHaveCoverage).toBe(1);
    expect(result.hasAllMustHaves).toBe(true);
  });
});

describe("computeSkillScore + shouldCallSemanticLayer", () => {
  it("volledige dekking geeft skillScore 100", () => {
    const result = matchSkills(["react", "css"], ["react"], ["css"]);
    expect(computeSkillScore(result)).toBe(100);
  });

  it("must-haves wegen zwaarder dan nice-to-haves in de skillScore", () => {
    // 100% must-have, 0% nice-to-have
    const mustHeavy = matchSkills(["react"], ["react"], ["css"]);
    // 0% must-have, 100% nice-to-have
    const niceHeavy = matchSkills(["css"], ["react"], ["css"]);
    expect(computeSkillScore(mustHeavy)).toBeGreaterThan(computeSkillScore(niceHeavy));
  });

  it("roept laag 2 aan zodra de must-have-dekking de voordrempel haalt", () => {
    const aboveThreshold = matchSkills(["react"], ["react", "typescript"], []); // 50% coverage
    expect(shouldCallSemanticLayer(aboveThreshold)).toBe(matchConfig.aiCallMustHaveThreshold <= 0.5);
  });

  it("slaat laag 2 over als de must-have-dekking onder de voordrempel blijft", () => {
    const belowThreshold = matchSkills([], ["react", "typescript", "node", "css"], []); // 0% coverage
    expect(shouldCallSemanticLayer(belowThreshold)).toBe(false);
  });
});

describe("combineScores (eindscore + knock-out)", () => {
  it("combineert skill- en semantische score volgens de config-gewichten", () => {
    const skillResult = matchSkills(["react", "typescript"], ["react", "typescript"], []);
    const skillScore = 100;
    const semanticScore = 80;
    const combined = combineScores(skillResult, skillScore, semanticScore, "Goede match.", 90);
    const expected = Math.round(skillScore * matchConfig.skillWeight + semanticScore * matchConfig.semanticWeight);
    expect(combined.finalScore).toBe(expected);
    expect(combined.isPromising).toBe(expected >= 90);
  });

  it("gebruikt uitsluitend de skillScore als laag 2 is overgeslagen", () => {
    const skillResult = matchSkills(["react"], ["react"], []);
    const combined = combineScores(skillResult, 100, null, null, 90);
    expect(combined.finalScore).toBe(100);
    expect(combined.rationale).toMatch(/overgeslagen/);
  });

  it("knock-out: ontbrekende must-have capt de eindscore, ook bij een hoge semantische score", () => {
    const skillResult = matchSkills([], ["react"], []); // must-have ontbreekt
    const combined = combineScores(skillResult, 0, 95, "Sterke semantische fit.", 90);
    expect(combined.finalScore).toBeLessThanOrEqual(matchConfig.knockOutCapScore);
    expect(combined.isPromising).toBe(false);
  });

  it("geen knock-out nodig als alle must-haves aanwezig zijn", () => {
    const skillResult = matchSkills(["react"], ["react"], []);
    const combined = combineScores(skillResult, 100, 95, "Sterke fit.", 90);
    expect(combined.finalScore).toBeGreaterThan(matchConfig.knockOutCapScore);
  });
});
