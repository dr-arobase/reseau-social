import { createServer } from "node:http";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const port = Number(process.env.API_PORT || 3001);
const server = createServer(app);
server.listen(port, () => console.log(`API prête sur http://localhost:${port}`));

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
