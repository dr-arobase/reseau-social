import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma.js";
import { hashPassword, loginSchema, registerSchema, requireAuth, sessionUser, signToken, verifyPassword } from "../auth.js";
import { FOUNDER_LIMIT } from "../lib.js";

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Trop de tentatives. Réessayez dans quelques minutes." } });

// Les premiers inscrits reçoivent un numéro de membre fondateur (#0001, #0002…).
async function createUserWithFounderNumber(data) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const { _max } = await tx.user.aggregate({ _max: { founderNumber: true } });
        const next = (_max.founderNumber || 0) + 1;
        return tx.user.create({ data: { ...data, founderNumber: next <= FOUNDER_LIMIT ? next : null }, select: sessionUser });
      });
    } catch (error) {
      const collidedOnFounder = error.code === "P2002" && String(error.meta?.target).includes("founderNumber");
      if (!collidedOnFounder) throw error;
    }
  }
  return prisma.user.create({ data, select: sessionUser });
}

authRouter.post("/register", authLimiter, async (request, response) => {
  const input = registerSchema.parse(request.body);
  const email = input.email.toLowerCase();
  const handle = input.handle.toLowerCase();
  const taken = await prisma.user.findFirst({ where: { OR: [{ email }, { handle }] }, select: { email: true } });
  if (taken) return response.status(409).json({ error: taken.email === email ? "Ce courriel est déjà utilisé." : "Ce nom d'utilisateur est déjà pris." });
  const user = await createUserWithFounderNumber({ email, handle, name: input.name, passwordHash: await hashPassword(input.password) });
  response.status(201).json({ user, token: signToken(user.id) });
});

// Connexion par courriel ou par nom d'utilisateur.
authRouter.post("/login", authLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body);
  const identifier = input.identifier.toLowerCase().replace(/^@/, "");
  const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { handle: identifier }] } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) return response.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
  const { passwordHash: _passwordHash, updatedAt: _updatedAt, ...safeUser } = user;
  response.json({ user: safeUser, token: signToken(user.id) });
});

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

// Le jeton JWT est sans état : le client l'oublie, le serveur confirme simplement.
authRouter.post("/logout", (_request, response) => {
  response.status(204).end();
});
