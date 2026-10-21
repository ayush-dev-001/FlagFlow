import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from './db.js';
import { seed, type SeedOptions } from './seed.js';
import { connectTestDb, resetDatabase } from './test/helpers.js';

const opts: SeedOptions = {
  superadmin: { email: 'root@flagflow.test', password: 'superadmin-password' },
  demoAdmin: { email: 'admin@acme.test', password: 'demo-admin-password' },
};

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = connectTestDb();
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const counts = async () => ({
  organizations: await prisma.organization.count(),
  users: await prisma.user.count(),
  flags: await prisma.flag.count(),
  targets: await prisma.flagTarget.count(),
});

describe('seed', { timeout: 30_000 }, () => {
  it('creates the superadmin, demo org, demo admin and six flags', async () => {
    const { created } = await seed(prisma, opts);
    expect(created).toHaveLength(9);
    expect(await counts()).toEqual({ organizations: 1, users: 2, flags: 6, targets: 4 });

    const superadmin = await prisma.user.findUniqueOrThrow({ where: { email: opts.superadmin.email } });
    expect(superadmin).toMatchObject({ role: 'SUPERADMIN', orgId: null });
    expect(await bcrypt.compare(opts.superadmin.password, superadmin.passwordHash)).toBe(true);
    expect(superadmin.passwordHash).toMatch(/^\$2[ab]\$12\$/);
  });

  it('runs again without errors or duplicates', async () => {
    const before = await counts();
    const { created } = await seed(prisma, opts);
    expect(created).toEqual([]);
    expect(await counts()).toEqual(before);
  });

  it('keeps changes made after seeding', async () => {
    await prisma.flag.updateMany({ where: { key: 'dark_mode' }, data: { enabled: false } });
    await seed(prisma, opts);
    const flag = await prisma.flag.findFirstOrThrow({ where: { key: 'dark_mode' } });
    expect(flag.enabled).toBe(false);
  });

  it('treats emails case-insensitively', async () => {
    const { created } = await seed(prisma, {
      ...opts,
      superadmin: { ...opts.superadmin, email: opts.superadmin.email.toUpperCase() },
    });
    expect(created).toEqual([]);
  });
});
