import { PrismaClient, UserRole } from '@prisma/client';

const email = process.argv
  .slice(2)
  .find((argument) => argument !== '--')
  ?.trim()
  .toLocaleLowerCase('en-US');
if (!email) throw new Error('Usage: pnpm admin:grant -- admin@example.com');

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: UserRole.ADMIN, authVersion: { increment: 1 } },
      select: { id: true, email: true },
    });
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        action: 'admin.role.granted_local',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email },
      },
    });
    console.log(`Admin access granted to ${user.email}. Sign in again.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
