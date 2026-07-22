import type { Prisma } from "@prisma/client";

import { parseBooleanQuery, type QueryNode } from "./boolean-query";

/**
 * Vertaalt een booleaanse zoekterm naar een Prisma-`where`-filter op reeds
 * geïmporteerde vacatures (titel/bedrijf/omschrijving) — geen Adzuna-aanroep,
 * puur filteren op wat al in de database staat (zie /vacatures snelzoekbalk).
 * Losse module t.o.v. lib/search/boolean-query.ts zodat die laatste vrij
 * blijft van Prisma-afhankelijkheden en dus ook client-side (live
 * interpretatie in een formulier) geïmporteerd kan worden.
 */
function termFilter(value: string): Prisma.VacancyWhereInput {
  return {
    OR: [
      { title: { contains: value, mode: "insensitive" } },
      { companyName: { contains: value, mode: "insensitive" } },
      { description: { contains: value, mode: "insensitive" } },
    ],
  };
}

function nodeToFilter(node: QueryNode): Prisma.VacancyWhereInput {
  if (node.type === "term") return termFilter(node.value);
  if (node.type === "not") return { NOT: termFilter(node.term.value) };
  if (node.type === "and") return { AND: node.children.map(nodeToFilter) };
  return { OR: node.children.map(nodeToFilter) };
}

export function booleanQueryToVacancyFilter(query: string): Prisma.VacancyWhereInput {
  return nodeToFilter(parseBooleanQuery(query));
}
