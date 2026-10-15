import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { optionalAuth, requireAuth } from "../auth.js";
import { authorSelect, findPostOr404, hiddenUserIds, httpError, postInclude, serializePost } from "../lib.js";

export const postsRouter = Router();

const postSchema = z.object({
  content: z.string().trim().max(2200).default(""),
  imageUrl: z.string().url().max(500).nullable().optional(),
}).refine((post) => post.content || post.imageUrl, { message: "Ajoutez un texte ou une image." });

const commentSchema = z.object({ content: z.string().trim().min(1, "Le commentaire ne peut pas être vide.").max(1000) });

// Fil : ?feed=following (mes abonnements), ?q= (recherche), ?author=handle, ?media=1 (photos seulement).
postsRouter.get("/", optionalAuth, async (request, response) => {
  const viewerId = request.user?.id;
  const q = String(request.query.q || "").trim();
  const where = { authorId: { notIn: await hiddenUserIds(viewerId) } };
  const and = [];
  if (request.query.feed === "following" && viewerId) {
    const follows = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    and.push({ authorId: { in: [viewerId, ...follows.map((follow) => follow.followingId)] } });
  }
  if (request.query.author) and.push({ author: { handle: String(request.query.author).toLowerCase() } });
  if (request.query.media) and.push({ imageUrl: { not: null } });
  if (q) {
    const term = q.replace(/^[@#]/, "");
    and.push({ OR: [
      { content: { contains: q, mode: "insensitive" } },
      { author: { handle: { contains: term, mode: "insensitive" } } },
      { author: { name: { contains: term, mode: "insensitive" } } },
    ] });
  }
  const posts = await prisma.post.findMany({
    where: { ...where, AND: and },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(request.query.limit) || 50, 100),
    include: postInclude(viewerId),
  });
  response.json(posts.map(serializePost));
});

postsRouter.get("/:id", optionalAuth, async (request, response) => {
  const post = await prisma.post.findUnique({ where: { id: request.params.id }, include: postInclude(request.user?.id) });
  if (!post || (await hiddenUserIds(request.user?.id)).includes(post.authorId)) throw httpError(404, "Publication introuvable.");
  response.json(serializePost(post));
});

postsRouter.post("/", requireAuth, async (request, response) => {
  const data = postSchema.parse(request.body);
  const post = await prisma.post.create({ data: { ...data, authorId: request.user.id }, include: postInclude(request.user.id) });
  response.status(201).json(serializePost(post));
});

postsRouter.patch("/:id", requireAuth, async (request, response) => {
  const existing = await findPostOr404(request.params.id);
  if (existing.authorId !== request.user.id) throw httpError(403, "Vous ne pouvez modifier que vos publications.");
  const data = postSchema.parse(request.body);
  const post = await prisma.post.update({ where: { id: existing.id }, data, include: postInclude(request.user.id) });
  response.json(serializePost(post));
});

postsRouter.delete("/:id", requireAuth, async (request, response) => {
  const existing = await findPostOr404(request.params.id);
  if (existing.authorId !== request.user.id) throw httpError(403, "Vous ne pouvez supprimer que vos publications.");
  await prisma.post.delete({ where: { id: existing.id } });
  response.status(204).end();
});

// J'aime / je n'aime plus (bascule).
postsRouter.post("/:id/like", requireAuth, async (request, response) => {
  const post = await findPostOr404(request.params.id);
  const key = { userId_postId: { userId: request.user.id, postId: post.id } };
  const existing = await prisma.like.findUnique({ where: key });
  if (existing) await prisma.like.delete({ where: key });
  else await prisma.like.create({ data: { userId: request.user.id, postId: post.id } });
  response.json({ liked: !existing, likes: await prisma.like.count({ where: { postId: post.id } }) });
});

postsRouter.get("/:id/comments", optionalAuth, async (request, response) => {
  const post = await findPostOr404(request.params.id);
  const comments = await prisma.comment.findMany({
    where: { postId: post.id, authorId: { notIn: await hiddenUserIds(request.user?.id) } },
    orderBy: { createdAt: "asc" },
    include: { author: { select: authorSelect } },
  });
  response.json(comments);
});

postsRouter.post("/:id/comments", requireAuth, async (request, response) => {
  const post = await findPostOr404(request.params.id);
  if ((await hiddenUserIds(request.user.id)).includes(post.authorId)) throw httpError(403, "Action impossible avec ce compte.");
  const { content } = commentSchema.parse(request.body);
  const comment = await prisma.comment.create({ data: { content, postId: post.id, authorId: request.user.id }, include: { author: { select: authorSelect } } });
  response.status(201).json(comment);
});

// L'auteur du commentaire ou l'auteur de la publication peut supprimer un commentaire.
postsRouter.delete("/:id/comments/:commentId", requireAuth, async (request, response) => {
  const comment = await prisma.comment.findUnique({ where: { id: request.params.commentId }, include: { post: { select: { authorId: true } } } });
  if (!comment || comment.postId !== request.params.id) throw httpError(404, "Commentaire introuvable.");
  if (comment.authorId !== request.user.id && comment.post.authorId !== request.user.id) throw httpError(403, "Vous ne pouvez pas supprimer ce commentaire.");
  await prisma.comment.delete({ where: { id: comment.id } });
  response.status(204).end();
});
