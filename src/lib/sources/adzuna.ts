import { importConfig } from "../../config/import";
import type { Vacancy } from "../../types/vacancy";
import { adzunaSearchResponseSchema, type AdzunaJob } from "../validation/adzuna";
import type { JobSearchParams, JobSourceAdapter } from "./types";

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs/nl/search";

/** Zet app_id/app_key om naar "***" zodat de key nooit gelogd wordt. */
function maskUrl(url: URL): string {
  const masked = new URL(url.toString());
  if (masked.searchParams.has("app_id")) masked.searchParams.set("app_id", "***");
  if (masked.searchParams.has("app_key")) masked.searchParams.set("app_key", "***");
  return masked.toString();
}

function mapToVacancy(job: AdzunaJob, region: string): Vacancy {
  return {
    source: "ADZUNA",
    externalId: job.id,
    region,
    companyName: job.company.display_name,
    title: job.title,
    location: job.location.display_name,
    description: job.description,
    url: job.redirect_url,
    salaryMin: job.salary_min ?? null,
    salaryMax: job.salary_max ?? null,
    postedAt: job.created ? new Date(job.created) : null,
    rawData: job,
  };
}

/**
 * JobSourceAdapter-implementatie voor Adzuna. Bevraagt
 * `/v1/api/jobs/nl/search/{page}` met `app_id`/`app_key` uit de environment
 * (nooit hardcoded), pagineert tot een lege pagina of de veiligheidsrem van
 * `importConfig.maxPagesPerCombination`, valideert elke respons met Zod en
 * mapt naar het uniforme Vacancy-type.
 */
export class AdzunaAdapter implements JobSourceAdapter {
  readonly source = "ADZUNA" as const;

  async fetchVacancies(params: JobSearchParams): Promise<Vacancy[]> {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      throw new Error(
        "ADZUNA_APP_ID en ADZUNA_APP_KEY moeten gezet zijn in de environment (.env).",
      );
    }

    const vacancies: Vacancy[] = [];

    for (let page = 1; page <= importConfig.maxPagesPerCombination; page++) {
      const url = new URL(`${ADZUNA_BASE_URL}/${page}`);
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("what", params.what);
      url.searchParams.set("where", params.where);
      url.searchParams.set("max_days_old", String(importConfig.maxDaysOld));
      url.searchParams.set("results_per_page", String(importConfig.resultsPerPage));
      url.searchParams.set("content-type", "application/json");

      const maskedUrl = maskUrl(url);

      let response: Response;
      try {
        response = await fetch(url.toString());
      } catch (error) {
        throw new Error(
          `Adzuna-aanvraag mislukt (netwerkfout) voor ${maskedUrl}: ${(error as Error).message}`,
        );
      }

      if (!response.ok) {
        throw new Error(`Adzuna gaf status ${response.status} terug voor ${maskedUrl}`);
      }

      const json: unknown = await response.json();
      const parsed = adzunaSearchResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(
          `Ongeldig antwoord van Adzuna voor ${maskedUrl}: ${parsed.error.message}`,
        );
      }

      const { results } = parsed.data;
      if (results.length === 0) {
        break;
      }

      for (const job of results) {
        vacancies.push(mapToVacancy(job, params.where));
      }
    }

    return vacancies;
  }
}
