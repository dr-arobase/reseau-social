import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { navigate, timeAgo } from "../utils";
import { Avatar, ImagePicker, Modal, useToast } from "./ui";

const STORY_DURATION_MS = 5000;
const SEEN_KEY = "a-propos-seen-stories";

function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
}

function saveSeen(seen) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500))); } catch { /* facultatif */ }
}

export function StoriesBar() {
  const { user } = useAuth();
  const notify = useToast();
  const [groups, setGroups] = useState([]);
  const [seen, setSeen] = useState(readSeen);
  const [viewing, setViewing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => api("/stories").then(setGroups).catch((requestError) => notify(requestError.message, "error")), [notify]);
  useEffect(() => { load(); }, [load]);

  const markSeen = useCallback((id) => setSeen((current) => {
    if (current.has(id)) return current;
    const next = new Set(current).add(id);
    saveSeen(next);
    return next;
  }), []);

  const mine = groups.find((group) => group.author.id === user.id);
  const others = groups.filter((group) => group.author.id !== user.id);

  return (
    <section className="stories-section">
      <div className="section-heading"><h2>Stories</h2><small className="muted">Visibles 24 h</small></div>
      <div className="stories">
        <button className="story" onClick={() => (mine ? setViewing(groups.indexOf(mine)) : setCreating(true))}>
          <span className={`story-ring ${mine ? "" : "empty"}`}><Avatar user={user} />{!mine && <b className="story-plus">+</b>}</span>
          <span>{mine ? "Ma story" : "Ajouter"}</span>
        </button>
        {mine && <button className="story" onClick={() => setCreating(true)}><span className="story-ring empty"><span className="avatar story-add">+</span></span><span>Nouvelle</span></button>}
        {others.map((group) => {
          const unseen = group.stories.some((story) => !seen.has(story.id));
          return (
            <button className="story" key={group.author.id} onClick={() => setViewing(groups.indexOf(group))}>
              <span className={`story-ring ${unseen ? "" : "seen"}`}><Avatar user={group.author} /></span>
              <span>{group.author.name.split(" ")[0]}</span>
            </button>
          );
        })}
        {!others.length && <p className="muted stories-hint">Suivez des comptes pour voir leurs stories ici.</p>}
      </div>
      {creating && <StoryComposer onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
      {viewing !== null && groups[viewing] && <StoryViewer groups={groups} start={viewing} onSeen={markSeen} onClose={() => setViewing(null)} onDeleted={load} />}
    </section>
  );
}

function StoryComposer({ onClose, onCreated }) {
  const notify = useToast();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/stories", { body: { content: content.trim(), imageUrl } });
      notify("Story publiée pour 24 h.", "success");
      onCreated();
    } catch (requestError) {
      notify(requestError.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal title="Nouvelle story" onClose={onClose}>
      <form className="modal-body form-stack" onSubmit={submit}>
        <ImagePicker value={imageUrl} onChange={setImageUrl} onBusy={setUploading} />
        <label>Texte<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={300} rows={3} placeholder="Un mot pour accompagner votre story" /></label>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy || uploading || (!content.trim() && !imageUrl)}>Publier la story</button></div>
      </form>
    </Modal>
  );
}

function StoryViewer({ groups, start, onSeen, onClose, onDeleted }) {
  const { user } = useAuth();
  const notify = useToast();
  const [groupIndex, setGroupIndex] = useState(start);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const next = useCallback(() => {
    if (storyIndex < group.stories.length - 1) setStoryIndex(storyIndex + 1);
    else if (groupIndex < groups.length - 1) { setGroupIndex(groupIndex + 1); setStoryIndex(0); }
    else onClose();
  }, [storyIndex, group, groupIndex, groups.length, onClose]);

  const previous = () => {
    if (storyIndex > 0) setStoryIndex(storyIndex - 1);
    else if (groupIndex > 0) { setGroupIndex(groupIndex - 1); setStoryIndex(groups[groupIndex - 1].stories.length - 1); }
  };

  useEffect(() => { if (story) onSeen(story.id); }, [story, onSeen]);
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);
  useEffect(() => {
    if (paused || !story) return undefined;
    const timer = setTimeout(next, STORY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [story, paused, next]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!story) return null;

  async function remove() {
    try {
      await api(`/stories/${story.id}`, { method: "DELETE" });
      notify("Story supprimée.", "success");
      onClose();
      onDeleted();
    } catch (requestError) { notify(requestError.message, "error"); }
  }

  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`Story de ${group.author.name}`}>
      <div className="story-frame" onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)} onMouseLeave={() => setPaused(false)}>
        <div className="story-progress">{group.stories.map((item, index) => <span key={item.id} className={index < storyIndex ? "done" : index === storyIndex ? (paused ? "active paused" : "active") : ""} style={{ animationDuration: `${STORY_DURATION_MS}ms` }} />)}</div>
        <header>
          <button className="story-author" onClick={() => { onClose(); navigate("profil", group.author.handle); }}><Avatar user={group.author} className="avatar-small" /><strong>{group.author.name}</strong><small>{timeAgo(story.createdAt)}</small></button>
          {group.author.id === user.id && <button className="icon-button light" onClick={remove} aria-label="Supprimer la story">🗑</button>}
          <button className="icon-button light" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        {story.imageUrl ? <img src={story.imageUrl} alt="" /> : <div className="story-text-only" />}
        {story.content && <p className={`story-caption ${story.imageUrl ? "" : "big"}`}>{story.content}</p>}
        <button className="story-nav left" onClick={previous} aria-label="Story précédente" />
        <button className="story-nav right" onClick={next} aria-label="Story suivante" />
      </div>
    </div>
  );
}
