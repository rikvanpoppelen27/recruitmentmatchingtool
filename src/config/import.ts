/**
 * Technische veiligheidsinstellingen voor de Adzuna-adapter. Wát en wáár
 * gezocht wordt komt hier NIET meer vandaan (fase 6B) — dat staat per
 * zoekprofiel in de database (model `SearchProfile`, beheerd via
 * /zoekprofielen). Dit bestand bevat alleen generieke API-instellingen die
 * voor elk profiel gelden.
 */
export const importConfig = {
  /** Adzuna `results_per_page`. */
  resultsPerPage: 50,
  /** Veiligheidsrem: nooit meer dan dit aantal pagina's per API-aanroep. */
  maxPagesPerCombination: 5,
} as const;
