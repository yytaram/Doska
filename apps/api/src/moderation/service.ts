import { ModerationSeverity, Prisma, type PrismaClient } from '@prisma/client';

export function normalizeModerationText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function matchModerationTerms(
  prisma: PrismaClient | Prisma.TransactionClient,
  ...values: string[]
) {
  const normalizedText = normalizeModerationText(values.join(' '));
  const terms = await prisma.moderationTerm.findMany({
    where: { isActive: true },
    select: { id: true, term: true, normalizedTerm: true, severity: true },
  });
  const padded = ` ${normalizedText} `;
  const matches = terms.filter(({ normalizedTerm }) =>
    padded.includes(` ${normalizeModerationText(normalizedTerm)} `),
  );

  return {
    matches,
    hasBlock: matches.some(({ severity }) => severity === ModerationSeverity.BLOCK),
  };
}
