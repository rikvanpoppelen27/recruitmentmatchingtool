import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { runMatching } from "../src/lib/match/runMatching";

async function main() {
  const summary = await runMatching();

  console.log("\n=== Matches (gesorteerd op eindscore, kansrijk bovenaan) ===");
  for (const o of summary.outcomes) {
    const marker = o.isPromising ? "★ KANSRIJK" : "";
    const semantic = o.semanticScore === null ? "n.v.t. (overgeslagen)" : o.semanticScore;
    console.log(
      `${o.finalScore.toString().padStart(3)} | skill=${o.skillScore} semantisch=${semantic} | ` +
        `${o.candidateName} × ${o.vacancyLabel} ${marker}`,
    );
  }

  console.log(
    `\n=== Samenvatting match === nieuwe matches=${summary.newMatches}, AI-calls uitgevoerd=${summary.aiCallsMade}, ` +
      `AI-calls overgeslagen (voordrempel niet gehaald)=${summary.aiCallsSkipped}`,
  );
}

main()
  .catch((error) => {
    console.error("[match] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
