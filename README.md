# Bulles

Web app perso pour gérer une collection de bandes dessinées. Stack Express + EJS + TailwindCSS, base JSON fichier.

![Node](https://img.shields.io/badge/node-22-green) ![License](https://img.shields.io/badge/license-ISC-blue)

## Features

- **Collection** — liste de tout ce qu'on possède, avec couvertures, tags, tri et pagination
- **Wishlist** — BDs manquantes ou souhaitées
- **Vue par série** — progression par série (ex: 10/12 possédés, tome 4 manquant), notes par série
- **Dashboard** — stats globales, répartition par statut, top séries, derniers ajouts
- **Ajout en série** — "Tomes 1 à 12, manquants : 4, 9" en un clic
- **Couvertures auto** — recherche via Google Books + Open Library, ou upload manuel
- **Import CSV** — migration depuis Notion (mapping automatique des statuts)
- **Export CSV/JSON** — backup de la collection
- **Tags** — étiquettes libres (manga, franco-belge, dédicacé...)
- **Historique des statuts** — suivi des changements (quand on a acheté un tome)
- **Duplication** — copier une BD pour ajouter le tome suivant
- **Responsive** — utilisable sur mobile (menu hamburger, vue cards)
- **Migrations auto** — système de migration de la base de données au démarrage

## Stack

| Composant | Techno |
|---|---|
| Backend | Express 5 |
| Templates | EJS |
| CSS | Tailwind 3 |
| Base de données | JSON fichier (`data/db.json`) |
| Images | Google Books API, Open Library, upload local |

## Quickstart

```bash
git clone https://github.com/Sn0wAlice/Bulles.git
cd Bulles
npm install
npm run dev
```

L'app tourne sur `http://localhost:3000`.

## Docker

### Développement

```bash
docker compose up -d
```

### Production

```bash
docker compose -f docker-compose.prod.yml up -d
```

L'image utilise un build multi-stage (Tailwind compilé au build, Alpine + deps prod uniquement en runtime).

### Volumes

| Montage | Contenu |
|---|---|
| `./data` | Base de données (`db.json`) — persistée sur l'hôte |
| `./uploads` | CSV temporaires d'import |
| `covers` (named) | Couvertures uploadées |

## Structure

```
Bulles/
├── app.js                  # Serveur Express, routes
├── lib/
│   ├── store.js            # CRUD JSON + cache mémoire
│   ├── covers.js           # Recherche couverture (Google Books / Open Library)
│   ├── csv-import.js       # Parser CSV Notion
│   └── migrator.js         # Système de migration auto
├── data/
│   ├── db.json             # Base de données
│   └── migrations/         # Fichiers de migration
├── views/
│   ├── partials/           # head, nav, foot
│   ├── collection.ejs      # Collection / Wishlist / Tout
│   ├── series.ejs          # Vue par série
│   ├── dashboard.ejs       # Stats
│   ├── bulk-add.ejs        # Ajout en série
│   ├── form.ejs            # Ajout / Modification
│   └── import.ejs          # Import CSV / Export
├── public/
│   ├── css/style.css       # Tailwind compilé
│   └── js/app.js           # Client JS (filtres, tri, modals, AJAX)
├── Dockerfile
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Commandes

| Commande | Description |
|---|---|
| `npm run dev` | Build CSS + lance le serveur |
| `npm start` | Lance le serveur (CSS déjà buildé) |
| `npm run build:css` | Compile Tailwind |
| `npm run dev:css` | Tailwind en mode watch |

## Modèle de données

Chaque BD :

```json
{
  "id": "uuid",
  "serie": "One Piece",
  "titre": "One Piece - Tome 1",
  "numero": 1,
  "status": "owned",
  "commentaire": "",
  "web_tracking": "https://...",
  "cover_url": "https://...",
  "tags": ["manga", "shonen"],
  "status_history": [{"status": "owned", "date": "2026-03-19T..."}],
  "created_at": "2026-03-19T..."
}
```

Statuts : `owned`, `owned_no_hs`, `missing`, `in_progress`, `not_owned`

## Import Notion

Exporter la base Notion en CSV, puis utiliser le bouton "Importer" dans l'app. Mapping des colonnes :

| Notion | Bulles |
|---|---|
| Name | serie |
| Titre | titre |
| Numéro | numero |
| Status | status (mapping auto) |
| Commentaire | commentaire |
| Web traking | web_tracking |
