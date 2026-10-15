import { useEffect, useState } from "react";

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto", style: "short" });
const fullDate = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric" });

export function timeAgo(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return "à l'instant";
  const units = [["minute", 60], ["hour", 24], ["day", 7]];
  let amount = seconds / 60;
  for (const [unit, size] of units) {
    if (Math.abs(amount) < size) return relative.format(Math.round(amount), unit);
    amount /= size;
  }
  return fullDate.format(new Date(value));
}

export function formatDate(value) {
  return fullDate.format(new Date(value));
}

export function todayLabel() {
  return new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()).toUpperCase();
}

export function formatCount(value = 0) {
  return new Intl.NumberFormat("fr-CA", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

export function founderLabel(number) {
  return `#${String(number).padStart(4, "0")}`;
}

export function hashtags(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of new Set(post.content.toLowerCase().match(/#[\p{L}\p{N}_]+/gu) || [])) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Navigation par ancre (#/profil/marie) : fonctionne dans le navigateur et dans Electron (file://).
function parseHash() {
  const [name = "accueil", ...params] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  return { name: name || "accueil", params };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const update = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export function navigate(...parts) {
  window.location.hash = `#/${parts.map(encodeURIComponent).join("/")}`;
}
