import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Politique de sécurité du contenu, ajoutée seulement à la version compilée
// (le serveur de développement de Vite a besoin de scripts en ligne).
function contentSecurityPolicy(apiUrl) {
  const apiOrigin = new URL(apiUrl).origin;
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${apiOrigin}`,
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'none'",
  ].join("; ");
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_API_URL || "http://localhost:3001/api")],
    // Chemins relatifs : la version compilée s'ouvre aussi depuis le disque dans Electron (file://).
    base: "./",
    server: { port: 5173, strictPort: true },
  };
});
