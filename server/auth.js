import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma.js";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET doit être défini dans .env.");

export const sessionUser = { id: true, email: true, name: true, handle: true, bio: true, avatarUrl: true, founderNumber: true, createdAt: true };

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(72),
});

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72),
  name: z.string().trim().min(2).max(60),
  handle: z.string().trim().regex(/^[a-zA-Z0-9_.]{3,24}$/, "Nom d'utilisateur : 3 à 24 lettres, chiffres, points ou tirets bas."),
});

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
}

async function userFromHeader(header) {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), secret);
    return await prisma.user.findUnique({ where: { id: payload.sub }, select: sessionUser });
  } catch {
    return null;
  }
}

// Strict : bloque la requête si le jeton est absent ou invalide.
export async function requireAuth(request, response, next) {
  const user = await userFromHeader(request.headers.authorization);
  if (!user) return response.status(401).json({ error: "Session expirée ou invalide. Reconnectez-vous." });
  request.user = user;
  next();
}

// Optionnel : attache l'utilisateur si le jeton est valide, sinon continue en visiteur.
export async function optionalAuth(request, _response, next) {
  request.user = await userFromHeader(request.headers.authorization);
  next();
}
