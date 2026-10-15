import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { optionalAuth, requireAuth, sessionUser } from "../auth.js";
import { authorSelect, hiddenUserIds, httpError } from "../lib.js";

export const usersRouter = Router();

const profileSelect = { ...authorSelect, bio: true, createdAt: true, _count: { select: { followers: true, following: true, posts: true } } };

const profileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  handle: z.string().trim().regex(/^[a-zA-Z0-9_.]{3,24}$/).transform((value) => value.toLowerCase()).optional(),
  bio: z.string().trim().max(280).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

async function withRelation(users, viewerId) {
  if (!viewerId || !users.length) return users.map((user) => ({ ...user, isFollowing: false }));
  const follows = await prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: users.map((user) => user.id) } }, select: { followingId: true } });
  const followed = new Set(follows.map((follow) => follow.followingId));
  return users.map((user) => ({ ...user, isFollowing: followed.has(user.id) }));
}

// Recherche par nom ou nom d'utilisateur.
usersRouter.get("/", optionalAuth, async (request, response) => {
  const q = String(request.query.q || "").trim().replace(/^@/, "");
  const hidden = await hiddenUserIds(request.user?.id);
  const users = await prisma.user.findMany({
    where: {
      id: { notIn: hidden },
      ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { handle: { contains: q, mode: "insensitive" } }] }),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: profileSelect,
  });
  response.json(await withRelation(users, request.user?.id));
});

// Comptes à suivre : ceux que je ne suis pas encore, les plus suivis d'abord.
usersRouter.get("/suggestions", requireAuth, async (request, response) => {
  const hidden = await hiddenUserIds(request.user.id);
  const users = await prisma.user.findMany({
    where: { id: { notIn: [request.user.id, ...hidden] }, followers: { none: { followerId: request.user.id } } },
    orderBy: { followers: { _count: "desc" } },
    take: 5,
    select: profileSelect,
  });
  response.json(users.map((user) => ({ ...user, isFollowing: false })));
});

usersRouter.patch("/me", requireAuth, async (request, response) => {
  const data = profileSchema.parse(request.body);
  if (!Object.keys(data).length) throw httpError(400, "Aucun champ modifiable fourni.");
  if (data.handle && data.handle !== request.user.handle) {
    const taken = await prisma.user.findUnique({ where: { handle: data.handle }, select: { id: true } });
    if (taken) throw httpError(409, "Ce nom d'utilisateur est déjà pris.");
  }
  response.json({ user: await prisma.user.update({ where: { id: request.user.id }, data, select: sessionUser }) });
});

usersRouter.delete("/me", requireAuth, async (request, response) => {
  await prisma.user.delete({ where: { id: request.user.id } });
  response.status(204).end();
});

usersRouter.get("/:handle", optionalAuth, async (request, response) => {
  const user = await prisma.user.findUnique({ where: { handle: request.params.handle.toLowerCase() }, select: profileSelect });
  if (!user) throw httpError(404, "Utilisateur introuvable.");
  const viewerId = request.user?.id;
  const [following, block] = viewerId ? await Promise.all([
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } }),
    prisma.block.findFirst({ where: { OR: [{ blockerId: viewerId, blockedId: user.id }, { blockerId: user.id, blockedId: viewerId }] } }),
  ]) : [null, null];
  if (block && block.blockerId === user.id) throw httpError(404, "Utilisateur introuvable.");
  response.json({ ...user, isFollowing: Boolean(following), isBlocked: Boolean(block) });
});

// Suivre / ne plus suivre (bascule).
usersRouter.post("/:id/follow", requireAuth, async (request, response) => {
  const followingId = request.params.id;
  if (followingId === request.user.id) throw httpError(400, "Vous ne pouvez pas vous suivre vous-même.");
  const target = await prisma.user.findUnique({ where: { id: followingId }, select: { id: true } });
  if (!target) throw httpError(404, "Utilisateur introuvable.");
  if ((await hiddenUserIds(request.user.id)).includes(followingId)) throw httpError(403, "Action impossible avec ce compte.");
  const key = { followerId_followingId: { followerId: request.user.id, followingId } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) await prisma.follow.delete({ where: key });
  else await prisma.follow.create({ data: { followerId: request.user.id, followingId } });
  const followers = await prisma.follow.count({ where: { followingId } });
  response.json({ following: !existing, followers });
});

// Bloquer / débloquer (bascule). Bloquer retire aussi les abonnements dans les deux sens.
usersRouter.post("/:id/block", requireAuth, async (request, response) => {
  const blockedId = request.params.id;
  if (blockedId === request.user.id) throw httpError(400, "Vous ne pouvez pas vous bloquer vous-même.");
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw httpError(404, "Utilisateur introuvable.");
  const key = { blockerId_blockedId: { blockerId: request.user.id, blockedId } };
  const existing = await prisma.block.findUnique({ where: key });
  if (existing) {
    await prisma.block.delete({ where: key });
  } else {
    await prisma.$transaction([
      prisma.block.create({ data: { blockerId: request.user.id, blockedId } }),
      prisma.follow.deleteMany({ where: { OR: [{ followerId: request.user.id, followingId: blockedId }, { followerId: blockedId, followingId: request.user.id }] } }),
    ]);
  }
  response.json({ blocked: !existing });
});
