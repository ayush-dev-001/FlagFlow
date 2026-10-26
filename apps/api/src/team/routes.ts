import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { audit } from '../audit.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Sessions } from '../auth/sessions.js';
import { sha256 } from '../auth/tokens.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import type { Invite, User } from '../generated/prisma/client.js';
import { notFound, orgOf, parseId } from '../http.js';
import type { Mailer } from '../mailer.js';
import type { Limiters } from '../rateLimit.js';
import type { Redis } from '../redis.js';
import { createInviteBody, updateMemberBody } from './schemas.js';

export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export interface TeamDeps {
  prisma: PrismaClient;
  redis: Redis;
  sessions: Sessions;
  limiters: Limiters;
  mailer: Mailer;
  jwtSecret: string;
  dashboardOrigin: string;
}

export const toMember = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

const toInvite = (i: Invite) => ({
  id: i.id,
  email: i.email,
  role: i.role,
  status: i.status === 'PENDING' && i.expiresAt <= new Date() ? 'EXPIRED' : i.status,
  expiresAt: i.expiresAt.toISOString(),
  createdAt: i.createdAt.toISOString(),
});

export function teamRouter({
  prisma,
  redis,
  sessions,
  limiters,
  mailer,
  jwtSecret,
  dashboardOrigin,
}: TeamDeps) {
  const router = Router();
  router.use(requireAuth(jwtSecret, redis), limiters.api, requireRole('ADMIN', 'MEMBER'));
  const adminOnly = requireRole('ADMIN');

  router.get('/members', async (req, res) => {
    const users = await prisma.user.findMany({ where: { orgId: orgOf(req) }, orderBy: { createdAt: 'asc' } });
    res.json({ members: users.map(toMember) });
  });

  router.patch('/members/:id', adminOnly, async (req, res) => {
    const orgId = orgOf(req);
    const id = parseId(req.params.id, 'Member');
    const body = updateMemberBody.parse(req.body);

    const { before, after } = await prisma.$transaction(async (tx) => {
      // Lock the org row so concurrent changes to its admins run one after another.
      await tx.$queryRaw`SELECT id FROM organization WHERE id = ${orgId}::uuid FOR UPDATE`;
      const target = await tx.user.findFirst({ where: { id, orgId } });
      if (!target) throw notFound('Member');

      const losesAdmin =
        target.role === 'ADMIN' && target.isActive && (body.role === 'MEMBER' || body.isActive === false);
      if (losesAdmin) {
        const otherAdmins = await tx.user.count({
          where: { orgId, role: 'ADMIN', isActive: true, id: { not: id } },
        });
        if (otherAdmins === 0) {
          throw new AppError(409, 'LAST_ADMIN', 'An organization needs at least one active admin');
        }
      }

      const updated = await tx.user.update({ where: { id }, data: body });
      const base = { orgId, actorId: req.auth!.userId, ip: req.ip };
      if (body.role !== undefined && body.role !== target.role) {
        await audit(tx, {
          ...base,
          action: 'MEMBER_ROLE_CHANGED',
          metadata: { userId: id, before: { role: target.role }, after: { role: body.role } },
        });
      }
      if (body.isActive !== undefined && body.isActive !== target.isActive) {
        await audit(tx, {
          ...base,
          action: body.isActive ? 'MEMBER_REACTIVATED' : 'MEMBER_DEACTIVATED',
          metadata: { userId: id, before: { isActive: target.isActive }, after: { isActive: body.isActive } },
        });
      }
      return { before: target, after: updated };
    });

    // Tokens carry the role, so any change ends the member's sessions; they log in again with the new role.
    if (before.role !== after.role || before.isActive !== after.isActive) {
      await sessions.revokeAllForUser(id);
    }
    res.json({ member: toMember(after) });
  });

  router.get('/invites', adminOnly, async (req, res) => {
    const invites = await prisma.invite.findMany({
      where: { orgId: orgOf(req) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invites: invites.map(toInvite) });
  });

  router.post('/invites', adminOnly, async (req, res) => {
    const orgId = orgOf(req);
    const { email, role } = createInviteBody.parse(req.body);

    // One user, one org: an email that already has an account can't be invited anywhere.
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError(409, 'EMAIL_TAKEN', 'This email already has a FlagFlow account');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const { invite, org, inviter } = await prisma.$transaction(async (tx) => {
      // A new invite replaces any pending one for the same email, so only the latest link works.
      await tx.invite.updateMany({ where: { orgId, email, status: 'PENDING' }, data: { status: 'REVOKED' } });
      const invite = await tx.invite.create({
        data: { orgId, email, role, tokenHash: sha256(token), expiresAt },
      });
      await audit(tx, {
        orgId,
        actorId: req.auth!.userId,
        ip: req.ip,
        action: 'MEMBER_INVITED',
        metadata: { after: { inviteId: invite.id, email, role } },
      });
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });
      const inviter = await tx.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
      return { invite, org, inviter };
    });

    try {
      await mailer.sendInvite({
        to: email,
        organizationName: org.name,
        inviterName: inviter.name,
        role,
        link: `${dashboardOrigin}/invite/${token}`,
        expiresAt,
      });
    } catch (err) {
      // Nobody can use an invite whose email never left: cancel it, so it doesn't sit there pending.
      req.log.error({ err, inviteId: invite.id }, 'invite email could not be sent');
      await prisma.invite.update({ where: { id: invite.id }, data: { status: 'REVOKED' } });
      throw new AppError(
        502,
        'EMAIL_NOT_SENT',
        'The invite email could not be sent, so the invite was cancelled. Check the email settings and try again.',
      );
    }
    res.status(201).json({ invite: toInvite(invite) });
  });

  router.delete('/invites/:id', adminOnly, async (req, res) => {
    const orgId = orgOf(req);
    const id = parseId(req.params.id, 'Invite');
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.invite.updateMany({
        where: { id, orgId, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });
      if (count === 0) throw notFound('Pending invite');
      await audit(tx, {
        orgId,
        actorId: req.auth!.userId,
        ip: req.ip,
        action: 'INVITE_REVOKED',
        metadata: { inviteId: id },
      });
    });
    res.status(204).end();
  });

  return router;
}
