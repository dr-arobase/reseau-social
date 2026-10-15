import { app, BrowserWindow, shell } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isDev = process.argv.includes("--dev");
const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
const apiPort = process.env.API_PORT || 3001;
let apiProcess;

async function apiIsRunning() {
  try {
    const response = await fetch(`http://localhost:${apiPort}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

// Démarre l'API Express si elle ne tourne pas déjà (par exemple via `npm run dev:web`).
async function startApi() {
  if (await apiIsRunning()) return;
  apiProcess = spawn(process.execPath, [path.join(root, "server", "index.js")], {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  });
  for (let attempt = 0; attempt < 40 && !(await apiIsRunning()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 250));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 380,
    minHeight: 640,
    title: "à propos",
    backgroundColor: "#fbfbfd",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(devServerUrl) && !url.startsWith("file://")) event.preventDefault();
  });
  if (isDev) window.loadURL(devServerUrl);
  else window.loadFile(path.join(root, "dist", "index.html"));
}

app.whenReady().then(async () => {
  await startApi();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => apiProcess?.kill());
