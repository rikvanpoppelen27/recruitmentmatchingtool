import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_USER_EMAIL = "recruiter@example.com";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: {
      email: DEFAULT_USER_EMAIL,
      name: "Default Recruiter",
    },
  });

  const existingMarket = await prisma.market.findFirst({ where: { userId: user.id } });
  if (!existingMarket) {
    // Market.domain/regions zijn nu vestigiaal (fase 6B verving de hardcoded
    // zoekterm/regio's door SearchProfile) — de Market-rij blijft nodig als
    // verplichte FK op Vacancy.
    await prisma.market.create({
      data: {
        userId: user.id,
        domain: "vacatures",
        regions: [],
      },
    });
  }

  const existingProfile = await prisma.searchProfile.findFirst();
  if (!existingProfile) {
    await prisma.searchProfile.create({
      data: {
        name: "Front-end Randstad",
        query: '"front-end developer" OR "frontend developer"',
        provinces: ["NH", "ZH"],
        maxDaysOld: 7,
        titleOnly: false,
        isActive: true,
      },
    });
  }

  console.log(`Seed klaar. Default user: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
