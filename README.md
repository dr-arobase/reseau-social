# à propos — réseau social (React + Electron + PostgreSQL)

Interface 100 % React, application de bureau Electron, API Express, base PostgreSQL via Prisma.

## Démarrer

```powershell
npm install
npm run db:up        # PostgreSQL dans Docker
npm run db:push      # crée / met à jour les tables
npm run db:seed      # comptes et publications de démonstration
npm run dev          # Vite + Electron (l'API démarre automatiquement)
```

| Commande | Ce qu'elle lance |
|---|---|
| `npm run dev` | Application Electron en développement (rechargement à chaud) |
| `npm run dev:web` | API + interface dans le navigateur sur http://localhost:5173 |
| `npm start` | Compile l'interface puis ouvre la version Electron finale (`dist/`) |
| `npm test` | Tests automatiques de l'API (PostgreSQL requis) |
| `npm run db:studio` | Explorer la base dans le navigateur |

## Comptes de test

| Identifiant | Mot de passe |
|---|---|
| `1` | `2` |
| `3` | `4` |
| `emilie.m`, `karim.atelier`, `sarah.lamont`, `thomas.huot` | `demo12345` |

Ces comptes sont créés par `npm run db:seed` et servent uniquement au développement. Les nouvelles inscriptions exigent un mot de passe de 8 caractères minimum.

## Fonctionnalités (phase 1)

Reprises du projet [projet-DA_1-mondat-4](https://github.com/dr-arobase/projet-DA_1-mondat-4) puis enrichies :

- Inscription, connexion (courriel ou nom d'utilisateur), déconnexion, session JWT de 7 jours
- Fil « Pour vous » et « Abonnements », création de publications texte et photo (envoi de fichier ou adresse web)
- Modifier et supprimer ses publications (menu •••)
- J'aime / Je n'aime plus, double-clic sur une photo pour aimer
- Commentaires : ajout, suppression (auteur du commentaire ou de la publication)
- Découvrir : recherche de publications, #hashtags, @comptes, avec photos libres Picsum à partager
- Fenêtre de détail d'une publication avec image, commentaires et likes
- Profils : grille ou fil, abonnés, abonnements, modification du nom, de la bio et de la photo
- Suivre / ne plus suivre, suggestions de comptes, sujets populaires
- Stories de 24 h (texte ou photo), visionneuse avec progression automatique
- Badge « Membre fondateur » numéroté pour les 1000 premiers inscrits
- Signaler une publication ou un compte, bloquer / débloquer (exigé par l'App Store et Google Play)
- Thème clair, sombre ou automatique ; mise en page adaptée aux téléphones (barre de navigation en bas)

## API

| Ressource | Routes |
|---|---|
| Authentification | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Publications | `GET/POST /api/posts`, `GET/PATCH/DELETE /api/posts/:id`, `POST /api/posts/:id/like` |
| Commentaires | `GET/POST /api/posts/:id/comments`, `DELETE /api/posts/:id/comments/:commentId` |
| Utilisateurs | `GET /api/users?q=`, `GET /api/users/suggestions`, `GET /api/users/:handle`, `PATCH/DELETE /api/users/me`, `POST /api/users/:id/follow`, `POST /api/users/:id/block` |
| Stories | `GET/POST /api/stories`, `DELETE /api/stories/:id` |
| Divers | `POST /api/uploads` (image), `POST /api/reports`, `GET /api/photos` (Picsum), `GET /api/health` |

Organisation : `server/routes/` (une route par ressource), `server/auth.js` (JWT, bcrypt, Zod), `src/pages/` et `src/components/` pour l'interface.

## Plus tard : iOS et Android

L'interface est déjà responsive. La voie la plus directe sera Capacitor, qui emballe ce même code React dans une application iOS et Android. Il faudra alors héberger l'API en ligne et définir `VITE_API_URL`.

Avant une mise en production : migrations Prisma versionnées, stockage d'images externe (S3, Cloudinary…), rotation des secrets et outil de modération des signalements.
