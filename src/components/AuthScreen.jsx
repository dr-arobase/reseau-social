import { useState } from "react";
import { useAuth } from "../auth";

export default function AuthScreen() {
  const { authenticate, error: sessionError } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ identifier: "", email: "", name: "", handle: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const field = (name) => ({ value: form[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authenticate(mode, isRegister
        ? { email: form.email, name: form.name, handle: form.handle.replace(/^@/, ""), password: form.password }
        : { identifier: form.identifier, password: form.password });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand"><span className="brand-mark">à</span><span>à propos</span></div>
        <h1>Un seul endroit pour tout partager.</h1>
        <p>Photos, stories, discussions : retrouvez votre cercle sans jongler entre cinq applications.</p>
        <div className="founder-badge">✦ Les premiers inscrits deviennent membres fondateurs</div>
      </section>
      <form className="auth-card" onSubmit={submit}>
        <h2>{isRegister ? "Créer un compte" : "Se connecter"}</h2>
        <p className="muted">{isRegister ? "C'est gratuit, et ça le restera." : "Content de vous revoir."}</p>
        {isRegister ? (
          <>
            <label>Nom affiché<input {...field("name")} autoComplete="name" required minLength={2} maxLength={60} placeholder="Marie Lavoie" /></label>
            <label>Nom d'utilisateur<input {...field("handle")} autoComplete="username" required pattern="@?[a-zA-Z0-9_.]{3,24}" title="3 à 24 lettres, chiffres, points ou tirets bas" placeholder="marie.cree" /></label>
            <label>Courriel<input {...field("email")} type="email" autoComplete="email" required placeholder="marie@exemple.com" /></label>
          </>
        ) : (
          <label>Courriel ou nom d'utilisateur<input {...field("identifier")} autoComplete="username" required placeholder="marie@exemple.com ou marie.cree" /></label>
        )}
        <label>Mot de passe<input {...field("password")} type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 8 : 1} maxLength={72} placeholder={isRegister ? "8 caractères minimum" : "Votre mot de passe"} /></label>
        {(error || sessionError) && <p className="error-message">{error || sessionError}</p>}
        <button className="primary-button wide" disabled={busy}>{busy ? "Un instant..." : isRegister ? "Créer mon compte" : "Se connecter"}</button>
        <p className="auth-switch">
          {isRegister ? "Déjà membre ?" : "Pas encore de compte ?"}{" "}
          <button type="button" className="text-button" onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}>{isRegister ? "Se connecter" : "S'inscrire"}</button>
        </p>
      </form>
    </div>
  );
}
