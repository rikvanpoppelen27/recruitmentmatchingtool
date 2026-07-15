/**
 * Standaardconfig voor de vacature-import (fase 1). Aanpassen = deze
 * waarden wijzigen, geen code in de adapter zelf.
 */
export const importConfig = {
  /** Zoekterm-varianten — elke variant wordt los bevraagd per regio. */
  searchTerms: ["front-end developer", "frontend developer"],
  /** Eén Adzuna-call per regio. */
  regions: ["Noord-Holland", "Zuid-Holland"],
  /** Adzuna `max_days_old`. */
  maxDaysOld: 7,
  /** Adzuna `results_per_page`. */
  resultsPerPage: 50,
  /** Veiligheidsrem: nooit meer dan dit aantal pagina's per combinatie. */
  maxPagesPerCombination: 5,
} as const;
