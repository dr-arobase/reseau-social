import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useToast } from "../components/ui";
import { founderLabel } from "../utils";

export default function Settings({ theme, setTheme }) {
  const { user, signOut } = useAuth();
  const notify = useToast();
  const [confirmText, setConfirmText] = useState("");

  async function deleteAccount() {
    try {
      await api("/users/me", { method: "DELETE" });
      notify("Compte supprimé.", "success");
      signOut();
    } catch (requestError) { notify(requestError.message, "error"); }
  }

  return (
    <>
      <div className="welcome"><p className="eyebrow">PARAMÈTRES</p><h1>Votre compte</h1></div>
      <section className="panel settings-section">
        <h2>Apparence</h2>
        <div className="segmented">
          {[["system", "Automatique"], ["light", "Clair"], ["dark", "Sombre"]].map(([value, label]) => <button key={value} className={theme === value ? "active" : ""} onClick={() => setTheme(value)}>{label}</button>)}
        </div>
      </section>
      <section className="panel settings-section">
        <h2>Compte</h2>
        <dl className="settings-list">
          <dt>Courriel</dt><dd>{user.email}</dd>
          <dt>Nom d'utilisateur</dt><dd>@{user.handle}</dd>
          <dt>Statut</dt><dd>{user.founderNumber ? `Membre fondateur ${founderLabel(user.founderNumber)}` : "Membre"}</dd>
        </dl>
        <button className="secondary-button" onClick={signOut}>Se déconnecter</button>
      </section>
      <section className="panel settings-section danger-zone">
        <h2>Supprimer mon compte</h2>
        <p className="muted">Vos publications, commentaires, stories et abonnements seront effacés définitivement. Tapez <b>{user.handle}</b> pour confirmer.</p>
        <div className="url-field">
          <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={user.handle} />
          <button className="danger-button" disabled={confirmText !== user.handle} onClick={deleteAccount}>Supprimer définitivement</button>
        </div>
      </section>
    </>
  );
}
