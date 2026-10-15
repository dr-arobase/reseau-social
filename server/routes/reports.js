import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { httpError } from "../lib.js";

export const reportsRouter = Router();

const reportSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  postId: z.string().optional(),
  userId: z.string().optional(),
}).refine((report) => report.postId || report.userId, { message: "Indiquez une publication ou un compte à signaler." });

// Signaler une publication ou un compte (exigé par l'App Store et Google Play pour les réseaux sociaux).
reportsRouter.post("/", requireAuth, async (request, response) => {
  const data = reportSchema.parse(request.body);
  if (data.userId === request.user.id) throw httpError(400, "Vous ne pouvez pas vous signaler vous-même.");
  if (data.postId && !(await prisma.post.findUnique({ where: { id: data.postId }, select: { id: true } }))) throw httpError(404, "Publication introuvable.");
  if (data.userId && !(await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } }))) throw httpError(404, "Utilisateur introuvable.");
  await prisma.report.create({ data: { ...data, reporterId: request.user.id } });
  response.status(201).json({ ok: true, message: "Merci, le signalement a été transmis." });
});
