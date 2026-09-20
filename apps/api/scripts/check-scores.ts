// check:scores (§3.2): recompute Participant.score from SUM(Answer.pointsAwarded)
// and report any drift. Run: pnpm --filter @quiz/api check:scores

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [participants, sums] = await Promise.all([
    prisma.participant.findMany(),
    prisma.answer.groupBy({ by: ['participantId'], _sum: { pointsAwarded: true } }),
  ]);
  const sumById = new Map(sums.map((r) => [r.participantId, r._sum.pointsAwarded ?? 0]));
  let mismatches = 0;
  for (const p of participants) {
    const sum = sumById.get(p.id) ?? 0;
    if (sum !== p.score) {
      mismatches++;
      console.warn(`DRIFT ${p.nickname} (${p.id}): stored=${p.score} recomputed=${sum}`);
    }
  }
  if (mismatches === 0) {
    console.log(`OK — ${participants.length} participants checked, no score drift.`);
  } else {
    console.error(`${mismatches} participant(s) with score drift.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
