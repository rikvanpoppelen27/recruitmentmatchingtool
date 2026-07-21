/**
 * Onderhoudbare synoniemenlijst voor skill-matching. Elke sub-array is een
 * groep gelijkwaardige schrijfwijzen; de eerste term in de groep is de
 * canonieke naam waar alle andere naartoe genormaliseerd worden. Voeg een
 * nieuwe groep toe (of een alias aan een bestaande groep) om de matching
 * bij te stellen — geen code-wijzigingen elders nodig.
 */
export const skillAliasGroups: readonly (readonly string[])[] = [
  ["react", "react.js", "reactjs"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angular.js", "angularjs"],
  ["next", "next.js", "nextjs"],
  ["node", "node.js", "nodejs"],
  ["javascript", "js"],
  ["typescript", "ts"],
  ["css", "css3"],
  ["html", "html5"],
  ["scss", "sass"],
  ["sql", "mysql", "postgresql", "postgres"],
  [".net", "dotnet", "asp.net"],
];

const aliasToCanonical = new Map<string, string>();
for (const group of skillAliasGroups) {
  const canonical = group[0];
  for (const alias of group) {
    aliasToCanonical.set(alias, canonical);
  }
}

/** Normaliseert een skill naar lowercase en, indien bekend, de canonieke alias. */
export function canonicalizeSkill(skill: string): string {
  const normalized = skill.toLowerCase().trim();
  return aliasToCanonical.get(normalized) ?? normalized;
}
