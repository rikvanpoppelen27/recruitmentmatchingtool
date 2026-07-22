import type { AdzunaQueryClause } from "../search/boolean-query";
import type { Vacancy } from "../../types/vacancy";

export interface JobSearchParams {
  /** Eén Adzuna-boolean-clause (what_and/what_or/what_phrase/what_exclude) — zie lib/search/boolean-query.ts. */
  clause: AdzunaQueryClause;
  /** Adzuna title_only: alleen in de functietitel zoeken i.p.v. de volledige vacaturetekst. */
  titleOnly: boolean;
  /** Regio, bv. "Noord-Holland" (exacte Adzuna `where`-waarde, zie config/provinces.ts). */
  where: string;
  /** Adzuna `max_days_old`, per zoekprofiel instelbaar. */
  maxDaysOld: number;
}

/**
 * Contract voor een vacature-bron. Elke bron (Adzuna, later eventueel
 * Jobfeed) implementeert dit interface en mapt zijn eigen responsevorm naar
 * het uniforme Vacancy-type, zodat de rest van de applicatie
 * bron-onafhankelijk blijft.
 */
export interface JobSourceAdapter {
  readonly source: Vacancy["source"];
  fetchVacancies(params: JobSearchParams): Promise<Vacancy[]>;
}
