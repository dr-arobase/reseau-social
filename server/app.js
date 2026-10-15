import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { postsRouter } from "./routes/posts.js";
import { storiesRouter } from "./routes/stories.js";
import { photosRouter } from "./routes/photos.js";
import { uploadsDirectory, uploadsRouter } from "./routes/uploads.js";
import { reportsRouter } from "./routes/reports.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadsDirectory, { maxAge: "7d", immutable: true }));

app.get("/api/health", async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`;
  response.json({ status: "ok", database: "connected" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/stories", storiesRouter);
app.use("/api/photos", photosRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/reports", reportsRouter);

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "Route introuvable." });
});

app.use((error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    const field = issue?.path?.join(".");
    return response.status(400).json({ error: issue?.message && !issue.message.startsWith("Invalid") ? issue.message : `Champ invalide${field ? ` : ${field}` : ""}.`, details: error.issues });
  }
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Image trop lourde (8 Mo maximum)." : "Envoi de fichier invalide." });
  }
  const status = error.status || error.statusCode || (error.code === "P2002" ? 409 : error.code === "P2025" ? 404 : 500);
  if (status === 500) console.error(error);
  const message = status === 500 ? "Erreur interne du serveur." : error.code === "P2002" ? "Cette valeur est déjà utilisée." : error.code === "P2025" ? "Élément introuvable." : error.type === "entity.parse.failed" ? "JSON invalide." : error.message;
  response.status(status).json({ error: message });
});
