import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatCount, navigate, timeAgo } from "../utils";
import { ReportDialog, toggleBlock } from "./Moderation";
import { Avatar, FounderBadge, ImagePicker, Loading, Modal, useToast } from "./ui";

// Rend les #hashtags et @mentions cliquables.
export function RichText({ text }) {
  if (!text) return null;
  return text.split(/([#@][\p{L}\p{N}_.]+)/gu).map((part, index) => {
    if (part.startsWith("#")) return <button key={index} className="inline-link" onClick={() => navigate("decouvrir", part)}>{part}</button>;
    if (part.startsWith("@") && part.length > 1) return <button key={index} className="inline-link" onClick={() => navigate("profil", part.slice(1).replace(/\.$/, ""))}>{part}</button>;
    return part;
  });
}

export function AuthorLine({ author, date }) {
  return (
    <button className="author" onClick={() => navigate("profil", author.handle)}>
      <strong>{author.name} <FounderBadge number={author.founderNumber} compact /></strong>
      <span>@{author.handle}{date && ` · ${timeAgo(date)}`}</span>
    </button>
  );
}

export function PostComposer({ post, initial, onSaved, onCancel, autoFocus = false, compact = false }) {
  const { user } = useAuth();
  const notify = useToast();
  const [content, setContent] = useState(post?.content ?? initial?.content ?? "");
  const [imageUrl, setImageUrl] = useState(post?.imageUrl ?? initial?.imageUrl ?? null);
  const [expanded, setExpanded] = useState(!compact || Boolean(post || initial));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const canSubmit = (content.trim() || imageUrl) && !uploading && !busy;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const saved = await api(post ? `/posts/${post.id}` : "/posts", { method: post ? "PATCH" : "POST", body: { content: content.trim(), imageUrl } });
      onSaved?.(saved);
      if (!post) { setContent(""); setImageUrl(null); setExpanded(!compact); }
      notify(post ? "Publication modifiée." : "Publication partagée !", "success");
    } catch (requestError) {
      notify(requestError.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`composer ${expanded ? "expanded" : ""}`} onSubmit={submit}>
      <div className="composer-row">
        <Avatar user={user} />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="Qu'avez-vous envie de partager ?"
          rows={expanded ? 3 : 1}
          maxLength={2200}
          autoFocus={autoFocus}
        />
        {!expanded && <button className="primary-button" disabled={!canSubmit}>Publier</button>}
      </div>
      {expanded && (
        <>
          <ImagePicker value={imageUrl} onChange={setImageUrl} onBusy={setUploading} />
          <div className="composer-footer">
            <small className="muted">{content.length}/2200 · Astuce : #sujet et @mention sont cliquables</small>
            <div className="modal-actions">
              {(onCancel || compact) && <button type="button" className="secondary-button" onClick={() => { if (onCancel) onCancel(); else { setExpanded(false); setContent(""); setImageUrl(null); } }}>Annuler</button>}
              <button className="primary-button" disabled={!canSubmit}>{busy ? "Envoi..." : post ? "Enregistrer" : "Publier"}</button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

function PostMenu({ post, onEdit, onDeleted, onBlocked }) {
  const { user } = useAuth();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const menu = useRef(null);
  const isOwner = post.author.id === user.id;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !menu.current?.contains(event.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function remove() {
    setOpen(false);
    if (!window.confirm("Supprimer cette publication ? Cette action est définitive.")) return;
    try {
      await api(`/posts/${post.id}`, { method: "DELETE" });
      onDeleted?.(post.id);
      notify("Publication supprimée.", "success");
    } catch (requestError) { notify(requestError.message, "error"); }
  }

  async function block() {
    setOpen(false);
    if (!window.confirm(`Bloquer @${post.author.handle} ? Vous ne verrez plus ses publications et vous ne vous suivrez plus.`)) return;
    try { if (await toggleBlock(post.author, notify)) onBlocked?.(post.author.id); } catch (requestError) { notify(requestError.message, "error"); }
  }

  return (
    <div className="menu-anchor" ref={menu}>
      <button className="more-button" onClick={() => setOpen((value) => !value)} aria-label="Options de la publication" aria-expanded={open}>•••</button>
      {open && (
        <div className="dropdown" role="menu">
          {isOwner ? (
            <>
              <button onClick={() => { setOpen(false); onEdit(); }}>✎ Modifier</button>
              <button className="danger" onClick={remove}>🗑 Supprimer</button>
            </>
          ) : (
            <>
              <button onClick={() => { setOpen(false); navigate("profil", post.author.handle); }}>◉ Voir le profil</button>
              <button onClick={() => { setOpen(false); setReporting(true); }}>⚑ Signaler</button>
              <button className="danger" onClick={block}>⊘ Bloquer @{post.author.handle}</button>
            </>
          )}
        </div>
      )}
      {reporting && <ReportDialog target={{ postId: post.id }} onClose={() => setReporting(false)} />}
    </div>
  );
}

export function useLike(post, onChange) {
  const notify = useToast();
  const [pending, setPending] = useState(false);
  return async function toggleLike() {
    if (pending) return;
    setPending(true);
    const optimistic = { ...post, likedByMe: !post.likedByMe, _count: { ...post._count, likes: post._count.likes + (post.likedByMe ? -1 : 1) } };
    onChange(optimistic);
    try {
      const { liked, likes } = await api(`/posts/${post.id}/like`, { method: "POST" });
      onChange({ ...optimistic, likedByMe: liked, _count: { ...optimistic._count, likes } });
    } catch (requestError) {
      onChange(post);
      notify(requestError.message, "error");
    } finally {
      setPending(false);
    }
  };
}

async function sharePost(post, notify) {
  const text = `${post.author.name} (@${post.author.handle}) sur à propos :\n${post.content}${post.imageUrl ? `\n${post.imageUrl}` : ""}`;
  try {
    await navigator.clipboard.writeText(text);
    notify("Publication copiée, prête à être partagée.", "success");
  } catch {
    notify("Impossible de copier la publication.", "error");
  }
}

export function PostCard({ post, onChange, onDeleted, onBlocked }) {
  const notify = useToast();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const toggleLike = useLike(post, onChange);

  return (
    <article className="post-card">
      <div className="post-header">
        <button onClick={() => navigate("profil", post.author.handle)} aria-label={`Profil de ${post.author.name}`}><Avatar user={post.author} /></button>
        <AuthorLine author={post.author} date={post.createdAt} />
        <PostMenu post={post} onEdit={() => setEditing(true)} onDeleted={onDeleted} onBlocked={onBlocked} />
      </div>
      {post.content && <p className="post-text"><RichText text={post.content} /></p>}
      {post.imageUrl && <button className="post-image" onClick={() => setViewing(true)} onDoubleClick={() => !post.likedByMe && toggleLike()}><img src={post.imageUrl} alt="" loading="lazy" /></button>}
      <div className="post-actions">
        <button className={post.likedByMe ? "liked" : ""} onClick={toggleLike} aria-pressed={post.likedByMe}>{post.likedByMe ? "♥" : "♡"} {formatCount(post._count.likes)}</button>
        <button onClick={() => setViewing(true)}>◯ {formatCount(post._count.comments)}</button>
        <button onClick={() => sharePost(post, notify)}>↗ Partager</button>
      </div>
      {post._count.comments > 0 && <button className="view-comments" onClick={() => setViewing(true)}>Voir {post._count.comments > 1 ? `les ${post._count.comments} commentaires` : "le commentaire"}</button>}
      {editing && <Modal title="Modifier la publication" onClose={() => setEditing(false)}><div className="modal-body"><PostComposer post={post} onCancel={() => setEditing(false)} onSaved={(saved) => { onChange(saved); setEditing(false); }} /></div></Modal>}
      {viewing && <PostModal post={post} onChange={onChange} onClose={() => setViewing(false)} />}
    </article>
  );
}

// Détail d'une publication : image, légende, commentaires, like.
export function PostModal({ post, onChange, onClose }) {
  const { user } = useAuth();
  const notify = useToast();
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const toggleLike = useLike(post, onChange);

  useEffect(() => {
    api(`/posts/${post.id}/comments`).then(setComments).catch((requestError) => { notify(requestError.message, "error"); setComments([]); });
  }, [post.id, notify]);

  const setCount = (comments) => onChange({ ...post, _count: { ...post._count, comments } });

  async function addComment(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const comment = await api(`/posts/${post.id}/comments`, { body: { content: draft } });
      setComments((current) => [...current, comment]);
      setCount(post._count.comments + 1);
      setDraft("");
    } catch (requestError) { notify(requestError.message, "error"); } finally { setBusy(false); }
  }

  async function removeComment(comment) {
    try {
      await api(`/posts/${post.id}/comments/${comment.id}`, { method: "DELETE" });
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setCount(Math.max(0, post._count.comments - 1));
    } catch (requestError) { notify(requestError.message, "error"); }
  }

  return (
    <Modal title="Publication" onClose={onClose} wide={Boolean(post.imageUrl)}>
      <div className={`post-detail ${post.imageUrl ? "with-image" : ""}`}>
        {post.imageUrl && <div className="post-detail-image"><img src={post.imageUrl} alt="" /></div>}
        <div className="post-detail-side">
          <div className="post-header"><Avatar user={post.author} /><AuthorLine author={post.author} date={post.createdAt} /></div>
          {post.content && <p className="post-text"><RichText text={post.content} /></p>}
          <div className="comment-list">
            {comments === null ? <Loading label="Chargement des commentaires..." /> : comments.length === 0 ? <p className="muted">Aucun commentaire. Lancez la conversation !</p> : comments.map((comment) => (
              <div className="comment" key={comment.id}>
                <Avatar user={comment.author} className="avatar-small" />
                <div>
                  <p><button className="inline-link strong" onClick={() => navigate("profil", comment.author.handle)}>{comment.author.name}</button> <RichText text={comment.content} /></p>
                  <small>{timeAgo(comment.createdAt)}{(comment.author.id === user.id || post.author.id === user.id) && <> · <button className="inline-link" onClick={() => removeComment(comment)}>Supprimer</button></>}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="post-actions">
            <button className={post.likedByMe ? "liked" : ""} onClick={toggleLike}>{post.likedByMe ? "♥" : "♡"} {formatCount(post._count.likes)} J'aime</button>
          </div>
          <form className="comment-form" onSubmit={addComment}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ajouter un commentaire..." maxLength={1000} autoFocus />
            <button className="text-button" disabled={busy || !draft.trim()}>Publier</button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

export function PostList({ posts, setPosts, empty }) {
  if (!posts.length) return empty;
  const update = (updated) => setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  const remove = (id) => setPosts((current) => current.filter((post) => post.id !== id));
  const hideAuthor = (authorId) => setPosts((current) => current.filter((post) => post.author.id !== authorId));
  return posts.map((post) => <PostCard key={post.id} post={post} onChange={update} onDeleted={remove} onBlocked={hideAuthor} />);
}
