import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { PostComposer, PostList } from "../components/Posts";
import { StoriesBar } from "../components/Stories";
import { EmptyState, Loading } from "../components/ui";
import { navigate, todayLabel } from "../utils";

const tabs = [["all", "Pour vous"], ["following", "Abonnements"]];

export default function Home({ onPostsLoaded }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState("all");
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPosts(null);
    setError("");
    api(`/posts?feed=${feed}`)
      .then((data) => { if (active) { setPosts(data); onPostsLoaded?.(data); } })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [feed, onPostsLoaded]);

  const hour = new Date().getHours();
  const greeting = hour < 5 || hour >= 18 ? "Bonsoir" : "Bonjour";

  return (
    <>
      <div className="welcome">
        <p className="eyebrow">{todayLabel()}</p>
        <h1>{greeting} {user.name.split(" ")[0]} <span>✦</span></h1>
        <p className="muted">Voici ce qui se passe dans votre cercle.</p>
      </div>
      <StoriesBar />
      <div className="feed-tabs" role="tablist">
        {tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={feed === value} className={`feed-tab ${feed === value ? "active" : ""}`} onClick={() => setFeed(value)}>{label}</button>)}
      </div>
      <PostComposer compact onSaved={(post) => setPosts((current) => [post, ...(current || [])])} />
      {error && <p className="error-message">{error}</p>}
      {posts === null && !error ? <Loading label="Chargement des publications..." /> : posts && (
        <PostList
          posts={posts}
          setPosts={setPosts}
          empty={feed === "following"
            ? <EmptyState icon="◎" title="Votre fil d'abonnements est vide">Suivez des comptes depuis <button className="inline-link" onClick={() => navigate("decouvrir")}>Découvrir</button> pour voir leurs publications ici.</EmptyState>
            : <EmptyState icon="✎" title="Aucune publication pour l'instant">Soyez la première personne à partager quelque chose !</EmptyState>}
        />
      )}
    </>
  );
}
