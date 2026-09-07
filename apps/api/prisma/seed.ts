import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const locations = [
  { name: "Beatty", address: "275 Beatty Dr" },
  { name: "Couloak", address: "9908 Couloak Dr" },
  { name: "Olin", address: "309 Olin Way" },
  { name: "Forney", address: "1585 Forney Creek Parkway" },
  { name: "Union", address: "3715 Union Road" },
  { name: "Aberdeen", address: "2610 Aberdeen Boulevard" },
  { name: "Mount Holly Huntersville", address: "3536 Mount Holly Huntersville" },
  { name: "Tate", address: "1781 Tate Boulevard" },
];

async function main() {
  for (const loc of locations) {
    const existing = await prisma.location.findFirst({ where: { name: loc.name } });
    if (!existing) {
      await prisma.location.create({ data: { ...loc, active: true, favorite: false } });
      console.log(`Seeded location: ${loc.name}`);
    } else {
      console.log(`Location already exists, skipping: ${loc.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
