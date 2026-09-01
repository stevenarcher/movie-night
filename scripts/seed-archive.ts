import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WEEKS_EPOCH = Date.UTC(2026, 0, 5);
const MS_PER_DAY = 86_400_000;

const films = [
  "The Well",
  "Luc Besson's Dracula",
  "The Rip",
  "Joe Baby",
  "Bone Lake",
  "The Wrecking Crew",
  "Good Fortune",
  "Love Hurts",
  "Sisu Road to Revenge",
  "We Bury The Dead",
  "The Bluff",
  "Coyotes",
  "War Machine",
  "Dust Bunny",
  "The Trust",
  "Pretty Lethal",
  "Mike & Nick & Nick & Alice",
  "Witchboard",
  "Primate",
  "Greenland Migration",
  "Thrash",
  "Apex",
  "Anaconda",
  "Send Help",
  "Stone Cold Fox",
  "Cold Storage",
  "Whistle",
  "Hunting Season",
  "Over Your Dead Body",
  "How to Make a Killing",
  "Now You See Me 3",
  "Enola Holmes 3",
  "The Housemaid",
  "Oddity",
  "Tuner",
  "The Devil's Mouth",
  "The Last House",
  "They Will Kill You",
  "The Drama",
  "Night Patrol",
  "Wildcat",
  "Hokum",
  "Is God Is",
  "Mother Mary",
  "Deathstalker",
];

function weekStartDate(weekNumber: number): Date {
  return new Date(WEEKS_EPOCH + (weekNumber - 1) * 7 * MS_PER_DAY);
}

async function main() {
  console.log("Deleting existing ratings...");
  await prisma.rating.deleteMany();
  console.log("Deleting existing screenings...");
  await prisma.screening.deleteMany();

  console.log(`Seeding ${films.length} screenings...`);

  for (let i = 0; i < films.length; i++) {
    const weekNumber = i + 1;
    await prisma.screening.create({
      data: {
        weekNumber,
        weekStart: weekStartDate(weekNumber),
        movieTitle: films[i],
        votes: 0,
      },
    });
    console.log(`  Week ${weekNumber}: ${films[i]}`);
  }

  console.log(`\nDone! ${films.length} screenings seeded.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
