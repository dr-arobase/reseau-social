import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { app } from "../server/app.js";
import { prisma } from "../server/prisma.js";
import { uploadsDirectory } from "../server/routes/uploads.js";

// Tests d'intégration : nécessitent PostgreSQL (npm run db:up). Les comptes créés sont supprimés à la fin.
const suffix = Date.now().toString(36);
let server;
let baseUrl;
const created = [];

async function call(path, { token, body, method = body ? "POST" : "GET" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body && { "Content-Type": "application/json" }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

async function register(name) {
  const handle = `${name}_${suffix}`;
  const { status, body } = await call("/api/auth/register", { body: { email: `${handle}@test.local`, password: "motdepasse123", name: `Test ${name}`, handle } });
  assert.equal(status, 201, JSON.stringify(body));
  created.push(body.user.id);
  return body;
}

before(async () => {
  server = createServer(app).listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
  server.close();
});

let alice;
let bob;
let postId;

test("santé de l'API et de la base", async () => {
  const { status, body } = await call("/api/health");
  assert.equal(status, 200);
  assert.equal(body.database, "connected");
});

test("inscription, connexion par courriel ou nom d'utilisateur, /me", async () => {
  alice = await register("alice");
  bob = await register("bob");
  assert.ok(alice.token);
  assert.equal(alice.user.passwordHash, undefined);
  assert.equal(typeof alice.user.founderNumber === "number" || alice.user.founderNumber === null, true);

  const duplicate = await call("/api/auth/register", { body: { email: `alice_${suffix}@test.local`, password: "motdepasse123", name: "Autre", handle: `autre_${suffix}` } });
  assert.equal(duplicate.status, 409);

  const byEmail = await call("/api/auth/login", { body: { identifier: `alice_${suffix}@test.local`, password: "motdepasse123" } });
  assert.equal(byEmail.status, 200);
  const byHandle = await call("/api/auth/login", { body: { identifier: `@alice_${suffix}`, password: "motdepasse123" } });
  assert.equal(byHandle.status, 200);
  const wrong = await call("/api/auth/login", { body: { identifier: `alice_${suffix}`, password: "mauvais-mdp" } });
  assert.equal(wrong.status, 401);

  const me = await call("/api/auth/me", { token: alice.token });
  assert.equal(me.body.user.handle, `alice_${suffix}`);
  assert.equal((await call("/api/auth/me")).status, 401);
});

test("création, lecture, modification et suppression de publications", async () => {
  assert.equal((await call("/api/posts", { body: { content: "sans jeton" } })).status, 401);
  assert.equal((await call("/api/posts", { token: alice.token, body: { content: "" } })).status, 400);

  const created = await call("/api/posts", { token: alice.token, body: { content: `Bonjour #test${suffix}`, imageUrl: "https://picsum.photos/id/10/600/600" } });
  assert.equal(created.status, 201);
  postId = created.body.id;

  const search = await call(`/api/posts?q=test${suffix}`);
  assert.equal(search.body.length, 1);

  assert.equal((await call(`/api/posts/${postId}`, { token: bob.token, method: "PATCH", body: { content: "piratage" } })).status, 403);
  const edited = await call(`/api/posts/${postId}`, { token: alice.token, method: "PATCH", body: { content: `Modifié #test${suffix}`, imageUrl: null } });
  assert.equal(edited.body.content, `Modifié #test${suffix}`);
});

test("likes en bascule", async () => {
  const liked = await call(`/api/posts/${postId}/like`, { token: bob.token, method: "POST" });
  assert.deepEqual(liked.body, { liked: true, likes: 1 });
  const feed = await call(`/api/posts?author=alice_${suffix}`, { token: bob.token });
  assert.equal(feed.body[0].likedByMe, true);
  const unliked = await call(`/api/posts/${postId}/like`, { token: bob.token, method: "POST" });
  assert.deepEqual(unliked.body, { liked: false, likes: 0 });
});

test("commentaires : ajout, lecture et suppression par l'auteur", async () => {
  assert.equal((await call(`/api/posts/${postId}/comments`, { token: bob.token, body: { content: "  " } })).status, 400);
  const comment = await call(`/api/posts/${postId}/comments`, { token: bob.token, body: { content: "Super !" } });
  assert.equal(comment.status, 201);
  const list = await call(`/api/posts/${postId}/comments`);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].author.handle, `bob_${suffix}`);
  const removed = await call(`/api/posts/${postId}/comments/${comment.body.id}`, { token: alice.token, method: "DELETE" });
  assert.equal(removed.status, 204);
});

test("abonnements, fil Abonnements et suggestions", async () => {
  const followed = await call(`/api/users/${alice.user.id}/follow`, { token: bob.token, method: "POST" });
  assert.deepEqual(followed.body, { following: true, followers: 1 });
  const feed = await call("/api/posts?feed=following", { token: bob.token });
  assert.ok(feed.body.some((post) => post.id === postId));
  const profile = await call(`/api/users/alice_${suffix}`, { token: bob.token });
  assert.equal(profile.body.isFollowing, true);
  assert.equal(profile.body._count.followers, 1);
  assert.equal((await call(`/api/users/${bob.user.id}/follow`, { token: bob.token, method: "POST" })).status, 400);
});

test("stories actives pendant 24 h", async () => {
  const story = await call("/api/stories", { token: alice.token, body: { content: "Ma première story" } });
  assert.equal(story.status, 201);
  const forBob = await call("/api/stories", { token: bob.token });
  assert.ok(forBob.body.some((group) => group.author.id === alice.user.id));
  assert.equal((await call(`/api/stories/${story.body.id}`, { token: bob.token, method: "DELETE" })).status, 403);
});

test("signalement et blocage masquent les contenus", async () => {
  const report = await call("/api/reports", { token: bob.token, body: { postId, reason: "Contenu inapproprié" } });
  assert.equal(report.status, 201);
  const blocked = await call(`/api/users/${alice.user.id}/block`, { token: bob.token, method: "POST" });
  assert.equal(blocked.body.blocked, true);
  const feed = await call(`/api/posts?q=test${suffix}`, { token: bob.token });
  assert.equal(feed.body.length, 0);
  const profile = await call(`/api/users/alice_${suffix}`, { token: bob.token });
  assert.equal(profile.body._count.followers, 0, "le blocage retire l'abonnement");
  await call(`/api/users/${alice.user.id}/block`, { token: bob.token, method: "POST" });
});

test("profil modifiable par son propriétaire", async () => {
  const updated = await call("/api/users/me", { token: alice.token, method: "PATCH", body: { bio: "Nouvelle bio" } });
  assert.equal(updated.body.user.bio, "Nouvelle bio");
  const conflict = await call("/api/users/me", { token: alice.token, method: "PATCH", body: { handle: `bob_${suffix}` } });
  assert.equal(conflict.status, 409);
});

test("envoi d'image refusé sans connexion ou si ce n'est pas une image", async () => {
  const form = new FormData();
  form.append("file", new Blob(["pas une image"], { type: "text/plain" }), "note.txt");
  assert.equal((await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: form })).status, 401);
  const rejected = await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: form, headers: { Authorization: `Bearer ${alice.token}` } });
  assert.equal(rejected.status, 400);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const imageForm = new FormData();
  imageForm.append("file", new Blob([png], { type: "image/png" }), "pixel.png");
  const accepted = await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: imageForm, headers: { Authorization: `Bearer ${alice.token}` } });
  assert.equal(accepted.status, 201);
  const { url } = await accepted.json();
  assert.equal((await fetch(url)).status, 200);
  await unlink(path.join(uploadsDirectory, path.basename(url)));
});

test("suppression de publication réservée à l'auteur", async () => {
  assert.equal((await call(`/api/posts/${postId}`, { token: bob.token, method: "DELETE" })).status, 403);
  assert.equal((await call(`/api/posts/${postId}`, { token: alice.token, method: "DELETE" })).status, 204);
  assert.equal((await call(`/api/posts/${postId}`)).status, 404);
});
