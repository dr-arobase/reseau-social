import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { uploadImage } from "../api";
import { founderLabel } from "../utils";

function initials(name = "?") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function Avatar({ user, className = "" }) {
  const [broken, setBroken] = useState(false);
  if (user?.avatarUrl && !broken) return <img className={`avatar ${className}`} src={user.avatarUrl} alt="" onError={() => setBroken(true)} />;
  return <span className={`avatar ${className}`} aria-hidden="true">{initials(user?.name)}</span>;
}

export function FounderBadge({ number, compact = false }) {
  if (!number) return null;
  if (compact) return <span className="founder-dot" title={`Membre fondateur ${founderLabel(number)}`}>✦</span>;
  return <div className="founder-badge">✦ Membre fondateur <span>{founderLabel(number)}</span></div>;
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fermer">✕</button></header>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "✦", title, children }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function Loading({ label = "Chargement..." }) {
  return <p className="loading"><span className="spinner" />{label}</p>;
}

// Choix d'une image : fichier depuis l'ordinateur ou adresse web, avec aperçu.
export function ImagePicker({ value, onChange, onBusy }) {
  const input = useRef(null);
  const [mode, setMode] = useState("file");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    onBusy?.(true);
    try { onChange(await uploadImage(file)); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); onBusy?.(false); }
  }

  if (value) {
    return (
      <div className="image-preview">
        <img src={value} alt="Aperçu" />
        <button type="button" className="icon-button" onClick={() => onChange(null)} aria-label="Retirer l'image">✕</button>
      </div>
    );
  }
  return (
    <div className="image-picker">
      <div className="segmented">
        <button type="button" className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}>Depuis l'ordinateur</button>
        <button type="button" className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>Par adresse web</button>
      </div>
      {mode === "file" ? (
        <button type="button" className="drop-zone" onClick={() => input.current.click()} disabled={busy}>
          {busy ? "Envoi de l'image..." : "▣  Choisir une photo (JPG, PNG, WebP, GIF · 8 Mo max)"}
        </button>
      ) : (
        <UrlField onSubmit={onChange} />
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pick} />
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

function UrlField({ onSubmit }) {
  const [url, setUrl] = useState("");
  const valid = /^https?:\/\/\S+$/.test(url.trim());
  return (
    <div className="url-field">
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (valid) onSubmit(url.trim()); } }} />
      <button type="button" className="secondary-button" disabled={!valid} onClick={() => onSubmit(url.trim())}>Ajouter</button>
    </div>
  );
}

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, tone = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.tone}`}>{toast.message}</div>)}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
