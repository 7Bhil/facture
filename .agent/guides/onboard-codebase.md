# Protocole Phase 0 : Prise en Main et Compréhension de l'Existant (Onboarding Codebase)

Ce guide définit le protocole obligatoire d'investigation préalable qu'un agent ou un ingénieur doit exécuter avant d'écrire la moindre ligne de code ou de modifier une architecture existante.

---

## 1. Règle Fondamentale : Comprendre Avant d'Agir

L'erreur la plus fréquente consiste à appliquer mécaniquement ses propres conventions à un dépôt existant sans en comprendre le contexte, l'historique et les compromis passés.

L'agent doit adopter la règle de non-ingérence destructive :
1. **L'existant fait foi** : Respecter les conventions locales de nommage, de structure et de formatage déjà en place, même si elles diffèrent des préférences personnelles.
2. **Zéro modification aveugle** : Ne jamais modifier un fichier sans avoir identifié ses consommateurs directs et son cycle de vie.
3. **Observation passive d'abord** : Lancer la suite de tests et vérifier l'état du dépôt avant toute modification.

---

## 2. Les 5 Étapes du Protocole d'Onboarding

```
+-------------------------------------------------------------+
| Étape 1 : Cartographie Initiale (Structure & Dépendances)   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Étape 2 : Vérification de la Ligne de Base (Baseline Tests) |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Étape 3 : Traçage de Flux de Bout en Bout                   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Étape 4 : Archéologie Git (Contexte & Décisions Passées)    |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Étape 5 : Tests de Caractérisation (Filet de Sécurité)      |
+-------------------------------------------------------------+
```

---

### Étape 1 : Cartographie Initiale & Génération de `CODEMAP.md`

Avant de coder, explorer systématiquement la racine et les dossiers clés. En cas d'intervention sur un projet complexe ou inconnu, consigner ou actualiser un fichier `CODEMAP.md` à la racine ou dans `.agent/`.

#### Actions Requises
1. **Inspecter les descripteurs de projet** :
   - Fichiers de dépendances : `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `composer.json`.
   - Identifier le gestionnaire de paquets exact (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `poetry.lock`). Ne jamais mélanger les gestionnaires.
2. **Identifier le point d'entrée applicatif** :
   - Serveur / API : `src/index.ts`, `src/main.rs`, `cmd/server/main.go`, `app/main.py`.
   - Client Web : `src/App.tsx`, `pages/_app.tsx`, `app/layout.tsx`.
3. **Formaliser la carte d'architecture** :
   - Découpage en couches : transport (routes/controllers), domaine métier (services/use-cases), persistance (repositories/ORM).
   - Localisation de la configuration et des variables d'environnement (`.env.example`, `config/`).

#### Modèle Standard de `CODEMAP.md`
```markdown
# CODEMAP du Projet

## Vue d'Ensemble
- Type d'application : API REST / Monolithe / SPA / Microservice
- Langage principal et runtime : TypeScript 5.x / Node.js 20 LTS
- Frameworks majeurs : Express / NestJS / Next.js / FastAPI

## Arborescence Structurante
- `src/api/` : Couche transport, validation des entrées et routage HTTP.
- `src/core/` : Logique métier pure et règles de gestion (zéro dépendance I/O).
- `src/infra/` : Implémentations concrètes (clients SQL, caches Redis, passerelles tierces).

## Contrats & Schémas
- Base de données : Migrations dans `prisma/migrations` ou `migrations/`.
- Schémas d'échanges : Schémas Zod dans `src/contracts/` ou OpenAPI `docs/openapi.yaml`.
```

---

### Étape 2 : Vérification de la Ligne de Base (Baseline Test Run)

Ne jamais commencer un travail sur une base instable sans le savoir.

#### Actions Requises
1. Exécuter la suite de tests existante **avant** toute modification :
   ```bash
   # Selon la stack détectée
   npm test
   pytest
   cargo test
   go test ./...
   ```
2. Vérifier l'état du linter et du compilateur :
   ```bash
   npm run lint || true
   npx tsc --noEmit || true
   ```
3. Si des tests échouent ou si des erreurs de typage préexistent :
   - Noter explicitement ces échecs dans le journal d'investigation.
   - Ne pas imputer ces échecs aux futures modifications.
   - Prévenir l'utilisateur si la branche de travail de départ est cassée.

---

### Étape 3 : Traçage de Flux de Bout en Bout

Avant de modifier une fonction ou une route, tracer le chemin complet suivi par une donnée ou un événement.

#### Schéma d'un Flux Typique
```
Entrée (HTTP / Message)
       |
       v
[Middleware / Auth / Validation]  --> Rejet immédiat si invalide (Fail Fast)
       |
       v
[Contrôleur / Handler]            --> Extraction des paramètres typés
       |
       v
[Service Métier]                  --> Règles de gestion, orchestration
       |
       v
[Couche d'Accès aux Données]      --> Requête SQL préparée / Transaction
       |
       v
Sortie (DTO de Réponse)           --> Sérialisation sans données sensibles
```

#### Liste de Contrôle du Traçage
- Où sont validées les entrées (middleware global, pipe, schéma dédié) ?
- Comment circule le contexte d'authentification et de tenant (`req.user`, AsyncLocalStorage) ?
- Où sont capturées et transformées les erreurs applicatives ?
- Existe-t-il des transactions actives pour garantir l'atomicité des écritures ?

---

### Étape 4 : Archéologie Git (Contexte et Raisons d'Être)

Le code montre comment le système fonctionne ; l'historique Git explique pourquoi il fonctionne ainsi.

#### Commandes Clés
1. **Comprendre l'historique d'un fichier sensible** :
   ```bash
   git log -n 5 --oneline -- path/to/file.ts
   ```
2. **Identifier l'auteur et le contexte d'une ligne complexe** :
   ```bash
   git blame -L 42,65 path/to/file.ts
   ```
3. **Examiner les PRs ou commits associés** :
   - Chercher les identifiants de tickets ou de PRs dans les messages de commit pour comprendre les contraintes métier qui ont justifié un choix atypique.

#### Règle de Chesterton
Ne supprimez ni ne refactorisez jamais un bloc de code obscur avant d'avoir découvert la raison pour laquelle il a été écrit ainsi (gestion d'un bug spécifique d'un tiers, contournement d'un cas limite, correctif de sécurité urgent).

---

### Étape 5 : Tests de Caractérisation (Characterization Testing)

Lorsque le code existant doit être refactorisé mais ne dispose pas d'une couverture de tests suffisante, l'agent doit écrire des tests de caractérisation avant tout changement.

#### Définition
Un test de caractérisation ne teste pas ce que le système *devrait* faire selon une spécification théorique. Il enregistre ce que le système *fait réellement* aujourd'hui, avec ses comportements nominaux et ses anomalies connues.

#### Protocole d'Écriture
1. Créer un fichier de test temporaire dédié (ex: `tests/characterization/legacy-billing.spec.ts`).
2. Fournir des entrées représentatives (cas nominaux, valeurs nulles, listes vides, valeurs négatives).
3. Exécuter le code existant et enregistrer le résultat obtenu dans l'assertion.
4. Lancer le test pour valider qu'il passe au vert avec le code non modifié.
5. Effectuer le refactoring étape par étape : le test de caractérisation garantit l'absence de régression.
6. Une fois le refactoring stabilisé et les tests unitaires cibles écrits, supprimer ou archiver les tests de caractérisation temporaires.

---

## 3. Synthèse des Commandes Rapides pour l'Agent

```bash
# 1. Vérifier l'état du dépôt et les branches
git status -s
git branch -v

# 2. Derniers commits du projet
git log -n 5 --oneline

# 3. Exécution de contrôle initial
npm test -- --watchAll=false
```
