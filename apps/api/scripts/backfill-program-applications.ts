import { PrismaClient, ProgramApplicationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting ProgramApplication backfill...');

  // 1. Find all ProjectPrograms that do not have a ProgramApplication
  const projectProgramsWithoutApp = await prisma.projectProgram.findMany({
    where: {
      application: null,
    },
  });

  console.log(`Found ${projectProgramsWithoutApp.length} ProjectPrograms without a ProgramApplication.`);

  let createdCount = 0;

  for (const pp of projectProgramsWithoutApp) {
    try {
      await prisma.programApplication.create({
        data: {
          organizationId: pp.organizationId,
          projectProgramId: pp.id,
          status: ProgramApplicationStatus.PREPARING,
          createdById: pp.createdById,
        },
      });
      createdCount++;
    } catch (e) {
      console.error(`Failed to create application for ProjectProgram ${pp.id}:`, e);
    }
  }

  console.log(`Successfully created ${createdCount} ProgramApplications.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
