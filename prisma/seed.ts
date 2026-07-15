import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { importConfig } from "../src/config/import";

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
    await prisma.market.create({
      data: {
        userId: user.id,
        domain: importConfig.searchTerms[0],
        regions: [...importConfig.regions],
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
