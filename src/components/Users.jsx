import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { navigate } from "../utils";
import { Avatar, FounderBadge, useToast } from "./ui";

export function FollowButton({ user, onChange, className = "follow-button" }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const { following, followers } = await api(`/users/${user.id}/follow`, { method: "POST" });
      onChange?.({ ...user, isFollowing: following, _count: user._count && { ...user._count, followers } });
    } catch (requestError) {
      notify(requestError.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return <button className={`${className} ${user.isFollowing ? "is-following" : ""}`} onClick={toggle} disabled={busy}>{user.isFollowing ? "Abonné ✓" : "Suivre"}</button>;
}

export function UserRow({ user, onChange }) {
  const { user: me } = useAuth();
  return (
    <div className="suggestion">
      <button onClick={() => navigate("profil", user.handle)} aria-label={`Profil de ${user.name}`}><Avatar user={user} /></button>
      <button className="suggestion-text" onClick={() => navigate("profil", user.handle)}>
        <strong>{user.name} <FounderBadge number={user.founderNumber} compact /></strong>
        <small>@{user.handle}{user._count && ` · ${user._count.followers} abonné${user._count.followers > 1 ? "s" : ""}`}</small>
      </button>
      {user.id !== me.id && <FollowButton user={user} onChange={onChange} />}
    </div>
  );
}
