import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ReportDialog, toggleBlock } from "../components/Moderation";
import { PostList } from "../components/Posts";
import { FollowButton } from "../components/Users";
import { Avatar, EmptyState, FounderBadge, ImagePicker, Loading, Modal, useToast } from "../components/ui";
import { formatCount, formatDate, navigate } from "../utils";
import { PostGrid } from "./Discover";

export default function Profile({ handle }) {
  const { user: me } = useAuth();
  const notify = useToast();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("grid");
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const target = (handle || me.handle).toLowerCase();
  const isMe = target === me.handle;

  useEffect(() => {
    let active = true;
    setProfile(null);
    setPosts(null);
    setError("");
    api(`/users/${encodeURIComponent(target)}`).then((data) => active && setProfile(data)).catch((requestError) => active && setError(requestError.message));
    api(`/posts?author=${encodeURIComponent(target)}&limit=100`).then((data) => active && setPosts(data)).catch(() => active && setPosts([]));
    return () => { active = false; };
  }, [target, me]);

  if (error) return <EmptyState icon="?" title="Profil introuvable">{error} <button className="inline-link" onClick={() => navigate("decouvrir")}>Chercher quelqu'un d'autre</button></EmptyState>;
  if (!profile) return <Loading label="Chargement du profil..." />;

  async function block() {
    if (!profile.isBlocked && !window.confirm(`Bloquer @${profile.handle} ? Vous ne verrez plus ses publications et vous ne vous suivrez plus.`)) return;
    try {
      const blocked = await toggleBlock(profile, notify);
      setProfile((current) => ({ ...current, isBlocked: blocked, isFollowing: false }));
      if (!blocked) api(`/posts?author=${encodeURIComponent(target)}&limit=100`).then(setPosts);
    } catch (requestError) { notify(requestError.message, "error"); }
  }

  return (
    <>
      <section className="panel profile-page">
        <div className="profile-cover large" />
        <div className="profile-body">
          <Avatar user={profile} className="avatar-xl" />
          <div className="profile-actions">
            {isMe ? <button className="secondary-button" onClick={() => setEditing(true)}>Modifier le profil</button> : (
              <>
                {!profile.isBlocked && <FollowButton user={profile} className="primary-button" onChange={(updated) => setProfile((current) => ({ ...current, ...updated }))} />}
                <button className="secondary-button" onClick={() => setReporting(true)}>⚑ Signaler</button>
                <button className="secondary-button danger" onClick={block}>{profile.isBlocked ? "Débloquer" : "⊘ Bloquer"}</button>
              </>
            )}
          </div>
          <h1>{profile.name}</h1>
          <p className="handle">@{profile.handle} · membre depuis le {formatDate(profile.createdAt)}</p>
          {profile.bio && <p className="bio">{profile.bio}</p>}
          <FounderBadge number={profile.founderNumber} />
          <div className="profile-stats">
            <span><b>{formatCount(profile._count.posts)}</b> publications</span>
            <span><b>{formatCount(profile._count.followers)}</b> abonnés</span>
            <span><b>{formatCount(profile._count.following)}</b> abonnements</span>
          </div>
        </div>
      </section>
      {profile.isBlocked ? <EmptyState icon="⊘" title="Vous avez bloqué ce compte">Ses publications sont masquées. Débloquez-le pour les revoir.</EmptyState> : (
        <>
          <div className="feed-tabs">
            <button className={`feed-tab ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}>▦ Grille</button>
            <button className={`feed-tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>☰ Fil</button>
          </div>
          {posts === null ? <Loading /> : !posts.length ? <EmptyState icon="▣" title="Aucune publication">{isMe ? "Partagez votre première publication depuis l'accueil." : "Ce compte n'a encore rien publié."}</EmptyState>
            : view === "grid" ? <PostGrid posts={posts} setPosts={setPosts} /> : <PostList posts={posts} setPosts={setPosts} />}
        </>
      )}
      {editing && <EditProfile onClose={() => setEditing(false)} />}
      {reporting && <ReportDialog target={{ userId: profile.id }} onClose={() => setReporting(false)} />}
    </>
  );
}

function EditProfile({ onClose }) {
  const { user, setUser } = useAuth();
  const notify = useToast();
  const [form, setForm] = useState({ name: user.name, handle: user.handle, bio: user.bio, avatarUrl: user.avatarUrl || null });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { user: updated } = await api("/users/me", { method: "PATCH", body: { ...form, handle: form.handle.replace(/^@/, "") } });
      setUser(updated);
      notify("Profil mis à jour.", "success");
      onClose();
      if (updated.handle !== user.handle) navigate("profil", updated.handle);
    } catch (requestError) {
      notify(requestError.message, "error");
      setBusy(false);
    }
  }

  const field = (name) => ({ value: form[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });

  return (
    <Modal title="Modifier le profil" onClose={onClose}>
      <form className="modal-body form-stack" onSubmit={submit}>
        <div className="label">Photo de profil</div>
        <ImagePicker value={form.avatarUrl} onChange={(avatarUrl) => setForm((current) => ({ ...current, avatarUrl }))} onBusy={setUploading} />
        <label>Nom affiché<input {...field("name")} required minLength={2} maxLength={60} /></label>
        <label>Nom d'utilisateur<input {...field("handle")} required pattern="@?[a-zA-Z0-9_.]{3,24}" /></label>
        <label>Bio<textarea {...field("bio")} maxLength={280} rows={3} placeholder="Quelques mots sur vous" /></label>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy || uploading}>Enregistrer</button></div>
      </form>
    </Modal>
  );
}
