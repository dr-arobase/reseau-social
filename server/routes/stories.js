import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { authorSelect, hiddenUserIds, httpError } from "../lib.js";

export const storiesRouter = Router();

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

const storySchema = z.object({
  content: z.string().trim().max(300).default(""),
  imageUrl: z.string().url().max(500).nullable().optional(),
}).refine((story) => story.content || story.imageUrl, { message: "Ajoutez un texte ou une image." });

// Stories encore actives (moins de 24 h) de mes abonnements et de moi, regroupées par auteur.
storiesRouter.get("/", requireAuth, async (request, response) => {
  const follows = await prisma.follow.findMany({ where: { followerId: request.user.id }, select: { followingId: true } });
  const hidden = await hiddenUserIds(request.user.id);
  const stories = await prisma.story.findMany({
    where: { expiresAt: { gt: new Date() }, authorId: { in: [request.user.id, ...follows.map((follow) => follow.followingId)], notIn: hidden } },
    orderBy: { createdAt: "asc" },
    include: { author: { select: authorSelect } },
  });
  const groups = new Map();
  for (const story of stories) {
    if (!groups.has(story.authorId)) groups.set(story.authorId, { author: story.author, stories: [] });
    groups.get(story.authorId).stories.push(story);
  }
  const ordered = [...groups.values()].sort((a, b) => (a.author.id === request.user.id ? -1 : b.author.id === request.user.id ? 1 : 0));
  response.json(ordered);
});

storiesRouter.post("/", requireAuth, async (request, response) => {
  const data = storySchema.parse(request.body);
  const story = await prisma.story.create({
    data: { ...data, authorId: request.user.id, expiresAt: new Date(Date.now() + STORY_LIFETIME_MS) },
    include: { author: { select: authorSelect } },
  });
  response.status(201).json(story);
});

storiesRouter.delete("/:id", requireAuth, async (request, response) => {
  const story = await prisma.story.findUnique({ where: { id: request.params.id }, select: { authorId: true } });
  if (!story) throw httpError(404, "Story introuvable.");
  if (story.authorId !== request.user.id) throw httpError(403, "Vous ne pouvez supprimer que vos stories.");
  await prisma.story.delete({ where: { id: request.params.id } });
  response.status(204).end();
});
