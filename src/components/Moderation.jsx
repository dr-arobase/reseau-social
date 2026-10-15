import { useState } from "react";
import { api } from "../api";
import { Modal, useToast } from "./ui";

const reasons = ["Spam ou arnaque", "Harcèlement ou intimidation", "Contenu violent ou haineux", "Nudité ou contenu sexuel", "Fausse identité", "Autre"];

export function ReportDialog({ target, onClose }) {
  const notify = useToast();
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { message } = await api("/reports", { body: { ...target, reason: details.trim() ? `${reason} — ${details.trim()}` : reason } });
      notify(message, "success");
      onClose();
    } catch (requestError) {
      notify(requestError.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal title={target.postId ? "Signaler la publication" : "Signaler le compte"} onClose={onClose}>
      <form className="modal-body form-stack" onSubmit={submit}>
        <fieldset className="choice-list">
          {reasons.map((option) => <label key={option}><input type="radio" name="reason" checked={reason === option} onChange={() => setReason(option)} />{option}</label>)}
        </fieldset>
        <label>Précisions (facultatif)<textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={400} rows={3} /></label>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="danger-button" disabled={busy}>Envoyer le signalement</button></div>
      </form>
    </Modal>
  );
}

export async function toggleBlock(user, notify) {
  const { blocked } = await api(`/users/${user.id}/block`, { method: "POST" });
  notify(blocked ? `@${user.handle} est bloqué. Vous ne verrez plus ses contenus.` : `@${user.handle} est débloqué.`, "success");
  return blocked;
}
