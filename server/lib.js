import { prisma } from "./prisma.js";

export const FOUNDER_LIMIT = Number(process.env.FOUNDER_LIMIT || 1000);

export const authorSelect = { id: true, name: true, handle: true, avatarUrl: true, founderNumber: true };

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Utilisateurs que je bloque ou qui me bloquent : leurs contenus sont masqués dans les deux sens.
export async function hiddenUserIds(userId) {
  if (!userId) return [];
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((block) => (block.blockerId === userId ? block.blockedId : block.blockerId));
}

export function postInclude(userId) {
  return {
    author: { select: authorSelect },
    _count: { select: { likes: true, comments: true } },
    likes: userId ? { where: { userId }, select: { userId: true }, take: 1 } : false,
  };
}

export function serializePost({ likes, ...post }) {
  return { ...post, likedByMe: Boolean(likes?.length) };
}

export async function findPostOr404(id) {
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!post) throw httpError(404, "Publication introuvable.");
  return post;
}
