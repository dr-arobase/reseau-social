import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../auth.js";
import { httpError } from "../lib.js";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const uploadsDirectory = path.resolve(projectRoot, process.env.UPLOADS_DIR || "uploads");
mkdirSync(uploadsDirectory, { recursive: true });

const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_request, file, done) => done(null, `${randomUUID()}${extensions[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, done) => done(extensions[file.mimetype] ? null : httpError(400, "Formats acceptés : JPG, PNG, WebP ou GIF."), Boolean(extensions[file.mimetype])),
});

export const uploadsRouter = Router();

// Envoi d'une image (champ « file ») ; renvoie l'URL publique à mettre dans un post ou une story.
uploadsRouter.post("/", requireAuth, upload.single("file"), (request, response) => {
  if (!request.file) throw httpError(400, "Aucune image reçue.");
  response.status(201).json({ url: `${request.protocol}://${request.get("host")}/uploads/${request.file.filename}` });
});
