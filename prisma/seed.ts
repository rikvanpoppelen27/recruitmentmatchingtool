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

  const existingTemplate = await prisma.mailTemplate.findFirst();
  if (!existingTemplate) {
    await prisma.mailTemplate.create({
      data: {
        name: "Standaard introductie",
        description: "De gebruikelijke introductiemail voor een nieuwe kandidaat-vacature-combinatie.",
        systemInstruction:
          "Schrijf een standaard introductiemail: professioneel en to-the-point, met de gebruikelijke opbouw uit het stijlprofiel.",
        isDefault: true,
      },
    });
    await prisma.mailTemplate.create({
      data: {
        name: "Korte follow-up",
        description: "Voor een kort vervolgbericht aan een opdrachtgever die de kandidaat al kent.",
        systemInstruction:
          "Schrijf een korte follow-up mail, maximaal 100 woorden, informeel, ervan uitgaand dat de opdrachtgever al eerder over deze kandidaat heeft gehoord.",
        isDefault: false,
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
