import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Comptes de démonstration pour que le réseau ne soit pas vide pendant les tests.
// Mot de passe commun : demo12345 — à ne jamais utiliser en production.
const prisma = new PrismaClient();

const people = [
  { handle: "emilie.m", name: "Émilie Martin", bio: "Photographe du dimanche, café du lundi au samedi." },
  { handle: "karim.atelier", name: "Karim Atelier", bio: "Peintre et illustrateur à Montréal. 🎨" },
  { handle: "sarah.lamont", name: "Sarah Lamont", bio: "Course à pied, randonnée et grand air." },
  { handle: "thomas.huot", name: "Thomas Huot", bio: "Développeur, joueur, curieux." },
];

const posts = [
  ["emilie.m", "Petit rappel : les bonnes idées commencent souvent par une conversation. ✨\n\nQu'est-ce qui vous inspire aujourd'hui ? #inspiration", "https://picsum.photos/id/1015/900/900"],
  ["karim.atelier", "La lumière était parfaite ce matin. Nouvelle série en préparation #art #automne2026", "https://picsum.photos/id/1043/900/900"],
  ["sarah.lamont", "Sortie au mont Royal avant le lever du soleil. Qui vient la semaine prochaine ? #randonnee", "https://picsum.photos/id/1018/900/900"],
  ["thomas.huot", "Premier jour sur à propos. On teste tout : posts, stories, commentaires. Bienvenue à tous ! #nouveau", null],
  ["emilie.m", "Les couleurs d'octobre ne déçoivent jamais. #automne2026", "https://picsum.photos/id/1039/900/900"],
  ["karim.atelier", "Esquisse du jour, encre et aquarelle. Vos avis ? @emilie.m #art", "https://picsum.photos/id/1060/900/900"],
];

// Comptes de test rapides demandés pour le développement (identifiant / mot de passe).
const testAccounts = [
  { handle: "1", password: "2", name: "Utilisateur 1" },
  { handle: "3", password: "4", name: "Utilisateur 3" },
];

async function main() {
  for (const account of testAccounts) {
    await prisma.user.upsert({
      where: { handle: account.handle },
      update: { passwordHash: await bcrypt.hash(account.password, 12) },
      create: { handle: account.handle, name: account.name, email: `${account.handle}@test.apropos`, passwordHash: await bcrypt.hash(account.password, 12) },
    });
  }
  console.log(`Comptes de test : ${testAccounts.map((account) => `${account.handle} / ${account.password}`).join(", ")}.`);
  const passwordHash = await bcrypt.hash("demo12345", 12);
  const users = {};
  for (const person of people) {
    users[person.handle] = await prisma.user.upsert({
      where: { handle: person.handle },
      update: {},
      create: { ...person, email: `${person.handle}@demo.apropos`, passwordHash },
    });
  }
  if (await prisma.post.count({ where: { authorId: { in: Object.values(users).map((user) => user.id) } } })) {
    console.log("Données de démonstration déjà présentes.");
    return;
  }
  for (const [index, [handle, content, imageUrl]] of posts.entries()) {
    await prisma.post.create({ data: { content, imageUrl, authorId: users[handle].id, createdAt: new Date(Date.now() - (posts.length - index) * 3600_000) } });
  }
  const handles = Object.keys(users);
  for (const follower of handles) {
    for (const following of handles) {
      if (follower !== following) await prisma.follow.create({ data: { followerId: users[follower].id, followingId: users[following].id } });
    }
  }
  await prisma.story.create({ data: { authorId: users["sarah.lamont"].id, content: "Lever de soleil 🌄", imageUrl: "https://picsum.photos/id/1036/720/1280", expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  console.log(`Démo prête : ${handles.length} comptes (mot de passe : demo12345).`);
}

main().finally(() => prisma.$disconnect());
