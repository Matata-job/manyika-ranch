import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const ranch = await prisma.ranch.upsert({
    where: { id: "ranch-manyika" },
    update: { name: "Manyika Ranch" },
    create: {
      id: "ranch-manyika",
      name: "Manyika Ranch",
      location: "Singida, Tanzania",
      timezone: "Africa/Dar_es_Salaam",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@manyikaranch.co.tz" },
    update: {},
    create: {
      email: "owner@manyikaranch.co.tz",
      name: "Ranch Owner",
      passwordHash,
      role: "OWNER",
      ranchId: ranch.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@manyikaranch.co.tz" },
    update: {},
    create: {
      email: "manager@manyikaranch.co.tz",
      name: "Farm Manager",
      passwordHash,
      role: "FARM_MANAGER",
      ranchId: ranch.id,
    },
  });

  const vet = await prisma.user.upsert({
    where: { email: "vet@manyikaranch.co.tz" },
    update: {},
    create: {
      email: "vet@manyikaranch.co.tz",
      name: "Dr. Mwangi",
      passwordHash,
      role: "VETERINARIAN",
      ranchId: ranch.id,
    },
  });

  const externalOwner = await prisma.user.upsert({
    where: { email: "investor@example.com" },
    update: {},
    create: {
      email: "investor@example.com",
      name: "External Investor",
      passwordHash,
      role: "EXTERNAL_OWNER",
      ranchId: ranch.id,
    },
  });

  const campNames = [
    "Camp Alpha", "Camp Beta", "Camp Gamma", "Camp Delta", "Camp Epsilon",
    "Camp Zeta", "Camp Eta", "Camp Theta", "Camp Iota", "Camp Kappa",
    "Camp Lambda", "Camp Mu",
  ];

  const camps = [];
  for (let i = 0; i < campNames.length; i++) {
    const camp = await prisma.camp.upsert({
      where: { id: `camp-${i + 1}` },
      update: {},
      create: {
        id: `camp-${i + 1}`,
        ranchId: ranch.id,
        name: campNames[i],
        latitude: -4.8167 + (Math.random() - 0.5) * 0.5,
        longitude: 34.75 + (Math.random() - 0.5) * 0.5,
        capacity: 100 + Math.floor(Math.random() * 200),
        waterSources: "Borehole, seasonal river",
      },
    });
    camps.push(camp);
  }

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@manyikaranch.co.tz" },
    update: { role: "CAMP_SUPERVISOR" },
    create: {
      email: "supervisor@manyikaranch.co.tz",
      name: "Camp Supervisor",
      passwordHash,
      role: "CAMP_SUPERVISOR",
      ranchId: ranch.id,
    },
  });

  // Ensure supervisor is assigned only to Camp Alpha & Camp Beta
  await prisma.userCampAssignment.deleteMany({ where: { userId: supervisor.id } });
  await prisma.userCampAssignment.createMany({
    data: [
      { userId: supervisor.id, campId: camps[0].id },
      { userId: supervisor.id, campId: camps[1].id },
    ],
  });

  const vaccines = [
    { name: "FMD (Foot and Mouth)", intervalDays: 180 },
    { name: "Anthrax", intervalDays: 365 },
    { name: "CBPP", intervalDays: 365 },
    { name: "Lumpy Skin Disease", intervalDays: 365 },
    { name: "Blackleg", intervalDays: 365 },
  ];

  for (const v of vaccines) {
    await prisma.vaccineCatalog.upsert({
      where: { name: v.name },
      update: {},
      create: v,
    });
  }

  const breeds = ["Boran", "Sahiwal", "Brahman", "Crossbreed", "Ankole"];
  const bulls: string[] = [];
  const cows: string[] = [];

  for (let i = 1; i <= 5; i++) {
    const bull = await prisma.animal.upsert({
      where: { eartag: `BULL-${String(i).padStart(3, "0")}` },
      update: {},
      create: {
        eartag: `BULL-${String(i).padStart(3, "0")}`,
        breed: breeds[i % breeds.length],
        sex: "MALE",
        dob: new Date(2018, i, 15),
        ageMonths: 84,
        ownerId: owner.id,
        campId: camps[0].id,
        status: "ACTIVE",
        colorMarkings: "Brown",
      },
    });
    bulls.push(bull.id);
  }

  for (let i = 1; i <= 20; i++) {
    const cow = await prisma.animal.upsert({
      where: { eartag: `COW-${String(i).padStart(3, "0")}` },
      update: {},
      create: {
        eartag: `COW-${String(i).padStart(3, "0")}`,
        breed: breeds[i % breeds.length],
        sex: "FEMALE",
        dob: new Date(2020, (i % 12), 10),
        ageMonths: 48,
        ownerId: i <= 3 ? externalOwner.id : owner.id,
        sireId: bulls[i % bulls.length],
        campId: camps[i % camps.length].id,
        status: "ACTIVE",
      },
    });
    cows.push(cow.id);

    await prisma.weightLog.create({
      data: {
        animalId: cow.id,
        weightKg: 250 + Math.random() * 200,
        recordedById: manager.id,
        date: new Date(),
      },
    });

    if (i <= 10) {
      await prisma.vaccination.create({
        data: {
          animalId: cow.id,
          vaccineName: "FMD (Foot and Mouth)",
          date: new Date(Date.now() - 120 * 86400000),
          nextDue: new Date(Date.now() + 60 * 86400000),
          administeredById: vet.id,
        },
      });
    }
  }

  for (let i = 1; i <= 15; i++) {
    await prisma.animal.upsert({
      where: { eartag: `CALF-${String(i).padStart(3, "0")}` },
      update: {},
      create: {
        eartag: `CALF-${String(i).padStart(3, "0")}`,
        breed: breeds[i % breeds.length],
        sex: i % 2 === 0 ? "MALE" : "FEMALE",
        dob: new Date(2025, (i % 12), 1),
        ageMonths: 6,
        ownerId: owner.id,
        sireId: bulls[i % bulls.length],
        damId: cows[i % cows.length],
        campId: camps[i % camps.length].id,
        status: "ACTIVE",
        acquisitionType: "BORN_ON_FARM",
      },
    });
  }

  await prisma.alert.create({
    data: {
      type: "VACCINATION_DUE",
      title: "Vaccination due: COW-005",
      message: "FMD vaccination is due for COW-005",
      animalId: cows[4],
      dueDate: new Date(Date.now() - 5 * 86400000),
    },
  });

  console.log("Seed completed!");
  console.log("Login: owner@manyikaranch.co.tz / admin123");
  console.log(`Created ${camps.length} camps, ${bulls.length} bulls, ${cows.length} cows`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
