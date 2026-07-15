/**
 * Uniforme interne representatie van een vacature, ongeacht de bron. Elke
 * bron-adapter (Adzuna, later eventueel Jobfeed) mapt zijn eigen
 * responsevorm naar dit type — de rest van de applicatie kent alleen dit
 * type, nooit de brondata rechtstreeks.
 */
export type VacancySource = "ADZUNA" | "JOBFEED";

export interface Vacancy {
  source: VacancySource;
  /** Id van de vacature bij de bron zelf. */
  externalId: string;
  /** Regio waarvoor deze zoekopdracht is uitgevoerd, bv. "Noord-Holland". */
  region: string;
  companyName: string;
  title: string;
  /** Vrije-tekst locatie zoals de bron die aanlevert, bv. "Amsterdam". */
  location: string;
  description: string;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: Date | null;
  /** Ruwe brondata, voor debugging/herverwerking. */
  rawData: unknown;
}
