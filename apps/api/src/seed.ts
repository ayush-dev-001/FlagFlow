import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createPrisma, type PrismaClient } from './db.js';
import { Role } from './generated/prisma/client.js';

export const BCRYPT_COST = 12;

const DEMO_ORG = { slug: 'acme', name: 'Acme Inc.' };

// The six features the demo app reacts to (PLAN.md §4), spread across all three board columns.
const DEMO_FLAGS = [
  { key: 'dark_mode', description: 'Dark theme', enabled: true, targetAll: false, targets: ['U001', 'U002'] },
  { key: 'chat_widget', description: 'Support chat bubble', enabled: true, targetAll: true, targets: [] },
  {
    key: 'analytics_dashboard',
    description: 'Analytics page',
    enabled: false,
    targetAll: false,
    targets: ['U001'],
  },
  {
    key: 'new_checkout',
    description: 'Redesigned checkout',
    enabled: true,
    targetAll: false,
    targets: ['U003'],
  },
  { key: 'beta_banner', description: 'Beta programme banner', enabled: true, targetAll: true, targets: [] },
  { key: 'export_report', description: 'Export PDF button', enabled: false, targetAll: false, targets: [] },
];

export interface SeedOptions {
  superadmin: { email: string; password: string };
  demoAdmin: { email: string; password: string };
}

export interface SeedResult {
  created: string[];
}

/**
 * Idempotent: creates whatever is missing and never touches rows that already exist,
 * so re-running it keeps any changes made through the dashboard.
 */
export async function seed(prisma: PrismaClient, opts: SeedOptions): Promise<SeedResult> {
  const created: string[] = [];

  const ensureUser = async (
    email: string,
    data: { name: string; role: Role; orgId: string | null },
    password: string,
  ) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    created.push(`user ${email}`);
    return prisma.user.create({
      data: { email, ...data, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
    });
  };

  await ensureUser(
    opts.superadmin.email,
    { name: 'Superadmin', role: Role.SUPERADMIN, orgId: null },
    opts.superadmin.password,
  );

  let org = await prisma.organization.findUnique({ where: { slug: DEMO_ORG.slug } });
  if (!org) {
    org = await prisma.organization.create({ data: DEMO_ORG });
    created.push(`organization ${DEMO_ORG.slug}`);
  }

  const admin = await ensureUser(
    opts.demoAdmin.email,
    { name: 'Acme Admin', role: Role.ADMIN, orgId: org.id },
    opts.demoAdmin.password,
  );

  for (const { targets, ...flag } of DEMO_FLAGS) {
    const existing = await prisma.flag.findUnique({ where: { orgId_key: { orgId: org.id, key: flag.key } } });
    if (existing) continue;
    await prisma.flag.create({
      data: {
        ...flag,
        orgId: org.id,
        createdById: admin.id,
        updatedById: admin.id,
        targets: { createMany: { data: targets.map((endUserId) => ({ endUserId, orgId: org.id })) } },
      },
    });
    created.push(`flag ${flag.key}`);
  }

  return { created };
}

const seedEnv = z.object({
  DATABASE_URL: z.url(),
  SUPERADMIN_EMAIL: z.email(),
  SUPERADMIN_PASSWORD: z.string().min(12),
  DEMO_ADMIN_EMAIL: z.email(),
  DEMO_ADMIN_PASSWORD: z.string().min(12),
});

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const parsed = seedEnv.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Seed needs valid ${keys} (run \`npm run setup:env\`)`);
  }
  const env = parsed.data;
  const prisma = createPrisma(env.DATABASE_URL);
  try {
    const { created } = await seed(prisma, {
      superadmin: { email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD },
      demoAdmin: { email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD },
    });
    console.log(created.length ? `Seeded: ${created.join(', ')}` : 'Seed: nothing to do, everything exists');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
