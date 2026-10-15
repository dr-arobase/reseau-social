import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { AuthProvider, useAuth } from "./auth";
import AuthScreen from "./components/AuthScreen";
import { PostComposer } from "./components/Posts";
import { UserRow } from "./components/Users";
import { Avatar, EmptyState, FounderBadge, Loading, Modal, ToastProvider } from "./components/ui";
import Discover from "./pages/Discover";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import { formatCount, hashtags, navigate, useHashRoute } from "./utils";

const THEME_KEY = "a-propos-theme";

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; }
  });
  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* facultatif */ }
  }, [theme]);
  return [theme, setTheme];
}

const navItems = [
  ["accueil", "⌂", "Accueil"],
  ["decouvrir", "⌕", "Découvrir"],
  ["creer", "⊕", "Créer"],
  ["profil", "◉", "Profil"],
  ["parametres", "⚙", "Paramètres"],
];

function Shell() {
  const { user } = useAuth();
  const route = useHashRoute();
  const [theme, setTheme] = useTheme();
  const [creating, setCreating] = useState(false);
  const [homePosts, setHomePosts] = useState([]);
  const [search, setSearch] = useState("");

  const go = (name) => (name === "creer" ? setCreating(true) : navigate(name));
  const isActive = (name) => route.name === name && (name !== "profil" || !route.params[0] || route.params[0] === user.handle);
  const toggleTheme = () => setTheme(document.documentElement.dataset.theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "light" : "dark");

  let page;
  if (route.name === "decouvrir") page = <Discover query={route.params[0] || ""} />;
  else if (route.name === "profil") page = <Profile handle={route.params[0]} />;
  else if (route.name === "parametres") page = <Settings theme={theme} setTheme={setTheme} />;
  else page = <Home onPostsLoaded={setHomePosts} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("accueil")}><span className="brand-mark">à</span><span>à propos</span></button>
        <nav className="main-nav">
          {navItems.slice(0, 4).map(([name, icon, label]) => <button key={name} className={`nav-item ${isActive(name) ? "active" : ""}`} onClick={() => go(name)}>{icon} <span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${isActive("parametres") ? "active" : ""}`} onClick={() => go("parametres")}>⚙ <span>Paramètres</span></button>
          <button className="profile-mini" onClick={() => navigate("profil", user.handle)}><Avatar user={user} /><span><strong>{user.name}</strong><small>@{user.handle}</small></span></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="brand mobile-only" onClick={() => navigate("accueil")}><span className="brand-mark">à</span></button>
          <form className="search-box" onSubmit={(event) => { event.preventDefault(); navigate("decouvrir", search.trim()); setSearch(""); }}>
            ⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." aria-label="Rechercher" />
          </form>
          <div className="top-actions">
            <button onClick={toggleTheme} aria-label="Changer le thème" title="Clair / sombre">☼</button>
            <button onClick={() => navigate("profil", user.handle)} aria-label="Mon profil"><Avatar user={user} /></button>
          </div>
        </header>
        <div className="content-grid">
          <section className="feed-column">{page}</section>
          <RightColumn trending={hashtags(homePosts)} />
        </div>
      </main>
      <nav className="bottom-nav">
        {navItems.map(([name, icon, label]) => <button key={name} className={isActive(name) ? "active" : ""} onClick={() => go(name)} aria-label={label}>{icon}<small>{label}</small></button>)}
      </nav>
      {creating && (
        <Modal title="Nouvelle publication" onClose={() => setCreating(false)}>
          <div className="modal-body"><PostComposer autoFocus onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); navigate("profil", user.handle); }} /></div>
        </Modal>
      )}
    </div>
  );
}

function RightColumn({ trending }) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState(null);

  useEffect(() => { api("/users/suggestions").then(setSuggestions).catch(() => setSuggestions([])); }, []);
  const update = useCallback((updated) => setSuggestions((current) => current.map((item) => (item.id === updated.id ? updated : item))), []);

  return (
    <aside className="right-column">
      <section className="panel profile-panel">
        <div className="profile-cover" />
        <div className="profile-body">
          <Avatar user={user} className="avatar-large" />
          <button className="edit-profile" onClick={() => navigate("profil", user.handle)}>Voir</button>
          <h2>{user.name}</h2>
          <p className="handle">@{user.handle}</p>
          {user.bio && <p className="bio">{user.bio}</p>}
          <FounderBadge number={user.founderNumber} />
        </div>
      </section>
      <section className="panel suggestions">
        <div className="section-heading"><h2>À suivre</h2><button className="text-button" onClick={() => navigate("decouvrir")}>Tout voir</button></div>
        {suggestions === null ? <Loading /> : suggestions.length ? suggestions.map((suggestion) => <UserRow key={suggestion.id} user={suggestion} onChange={update} />) : <p className="muted small">Vous suivez déjà tout le monde. Invitez vos amis !</p>}
      </section>
      {trending.length > 0 && (
        <section className="panel trending">
          <div className="section-heading"><h2>Sujets populaires</h2></div>
          {trending.map(([tag, count]) => <button className="trend" key={tag} onClick={() => navigate("decouvrir", tag)}><small>Dans votre fil</small><strong>{tag}</strong><span>{formatCount(count)} publication{count > 1 ? "s" : ""}</span></button>)}
        </section>
      )}
    </aside>
  );
}

function Gate() {
  const { status, error, restore, signOut } = useAuth();
  if (status === "checking") return <div className="center-screen"><Loading label="Connexion..." /></div>;
  if (status === "offline") {
    return (
      <div className="center-screen">
        <EmptyState icon="⚡" title="Serveur injoignable">{error}</EmptyState>
        <div className="modal-actions"><button className="secondary-button" onClick={signOut}>Se déconnecter</button><button className="primary-button" onClick={restore}>Réessayer</button></div>
      </div>
    );
  }
  if (status === "signed-out") return <AuthScreen />;
  return <Shell />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}
