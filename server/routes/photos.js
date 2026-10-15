import { Router } from "express";

export const photosRouter = Router();

// Proxy vers Picsum (photos libres de droits) pour remplir la page Découvrir, filtrable par auteur.
photosRouter.get("/", async (request, response) => {
  const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
  const limit = Math.min(50, Number.parseInt(request.query.limit, 10) || 30);
  const query = String(request.query.query || "").toLowerCase().trim();
  let upstream;
  try {
    upstream = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=${limit}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    return response.status(502).json({ error: "Le service de photos est injoignable." });
  }
  if (!upstream.ok) return response.status(502).json({ error: "Le service de photos a répondu avec une erreur." });
  const photos = await upstream.json();
  response.json(photos
    .filter((photo) => !query || (photo.author || "").toLowerCase().includes(query))
    .map((photo) => ({
      id: photo.id,
      author: photo.author,
      image: `https://picsum.photos/id/${photo.id}/600/600`,
      source: photo.url,
      width: photo.width,
      height: photo.height,
    })));
});
