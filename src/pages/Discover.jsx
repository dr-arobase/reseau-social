import { useEffect, useState } from "react";
import { api } from "../api";
import { PostComposer, PostModal } from "../components/Posts";
import { UserRow } from "../components/Users";
import { EmptyState, Loading, Modal } from "../components/ui";
import { formatCount, navigate, useDebounced } from "../utils";

const tabs = [["posts", "Publications"], ["users", "Comptes"], ["photos", "Photos libres"]];

export function PostGrid({ posts, setPosts }) {
  const [openId, setOpenId] = useState(null);
  const open = posts.find((post) => post.id === openId);
  const update = (updated) => setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  return (
    <>
      <div className="photo-grid">
        {posts.map((post) => (
          <button key={post.id} className={`grid-tile ${post.imageUrl ? "" : "text-tile"}`} onClick={() => setOpenId(post.id)}>
            {post.imageUrl ? <img src={post.imageUrl} alt="" loading="lazy" /> : <p>{post.content}</p>}
            <span className="tile-overlay">♥ {formatCount(post._count.likes)} · ◯ {formatCount(post._count.comments)}</span>
          </button>
        ))}
      </div>
      {open && <PostModal post={open} onChange={update} onClose={() => setOpenId(null)} />}
    </>
  );
}

export default function Discover({ query: routeQuery = "" }) {
  const [query, setQuery] = useState(routeQuery);
  const [tab, setTab] = useState("posts");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [photoPage] = useState(() => 1 + Math.floor(Math.random() * 10));
  const search = useDebounced(query.trim(), 300);

  useEffect(() => { setQuery(routeQuery); }, [routeQuery]);

  useEffect(() => {
    let active = true;
    setResults(null);
    setError("");
    const encoded = encodeURIComponent(search);
    const request = tab === "posts" ? api(`/posts?q=${encoded}&limit=60`) : tab === "users" ? api(`/users?q=${encoded}`) : api(`/photos?query=${encoded}&page=${photoPage}`);
    request.then((data) => active && setResults(data)).catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [tab, search, photoPage]);

  return (
    <>
      <div className="welcome">
        <p className="eyebrow">DÉCOUVRIR</p>
        <h1>Explorer à propos</h1>
        <p className="muted">Trouvez des publications, des sujets et des personnes à suivre.</p>
      </div>
      <div className="search-box large">
        ⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "photos" ? "Rechercher un photographe..." : "Rechercher un sujet, #hashtag, @utilisateur..."} autoFocus />
        {query && <button className="icon-button" onClick={() => { setQuery(""); navigate("decouvrir"); }} aria-label="Effacer">✕</button>}
      </div>
      <div className="feed-tabs" role="tablist">
        {tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={`feed-tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      {error && <p className="error-message">{error}</p>}
      {results === null && !error && <Loading label="Recherche..." />}
      {results && !results.length && <EmptyState icon="⌕" title="Aucun résultat">{search ? `Rien ne correspond à « ${search} ».` : "Il n'y a encore rien à afficher ici."}</EmptyState>}
      {results && results.length > 0 && tab === "posts" && <PostGrid posts={results} setPosts={setResults} />}
      {results && results.length > 0 && tab === "users" && <div className="panel user-list">{results.map((user) => <UserRow key={user.id} user={user} onChange={(updated) => setResults((current) => current.map((item) => (item.id === updated.id ? updated : item)))} />)}</div>}
      {results && results.length > 0 && tab === "photos" && (
        <>
          <p className="muted small">Photos libres de droits fournies par Picsum. Cliquez sur une photo pour la partager.</p>
          <div className="photo-grid">{results.map((item) => <button key={item.id} className="grid-tile" onClick={() => setPhoto(item)}><img src={item.image} alt={`Photo de ${item.author}`} loading="lazy" /><span className="tile-overlay">📷 {item.author}</span></button>)}</div>
        </>
      )}
      {photo && (
        <Modal title={`Photo de ${photo.author}`} onClose={() => setPhoto(null)}>
          <div className="modal-body form-stack">
            <img className="photo-preview" src={photo.image} alt="" />
            <div className="modal-actions"><button className="secondary-button" onClick={() => setPhoto(null)}>Fermer</button><button className="primary-button" onClick={() => { setSharing(photo); setPhoto(null); }}>Partager cette photo</button></div>
          </div>
        </Modal>
      )}
      {sharing && (
        <Modal title="Nouvelle publication" onClose={() => setSharing(null)}>
          <div className="modal-body"><PostComposer key={sharing.id} onCancel={() => setSharing(null)} onSaved={() => { setSharing(null); navigate("accueil"); }} initial={{ imageUrl: sharing.image, content: `📷 Photo de ${sharing.author}` }} /></div>
        </Modal>
      )}
    </>
  );
}
