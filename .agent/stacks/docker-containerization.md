# Règles Senior : Conteneurisation & Durcissement Docker

> **Standards de référence** : Docker Best Practices, CIS Docker Benchmark, OWASP Docker Top 10, OCI (Open Container Initiative).

---

## 1. Principe de Moindre Privilège & Utilisateur Non-Root

- **Bannissement de l'Utilisateur Root en Production** :
  - Par défaut, les conteneurs s'exécutent en tant que `root` (UID 0), ce qui constitue un risque critique d'évasion de conteneur (*Container Escape*).
  - Toujours déclarer un utilisateur non privilégié dédié en fin de Dockerfile :
    ```dockerfile
    # Exemple Node.js (utilisateur système préexistant)
    USER node

    # Exemple Alpine standard
    RUN addgroup -S appgroup && adduser -S appuser -G appgroup
    USER appuser
    ```
  - S'assurer que les fichiers applicatifs n'appartiennent qu'en lecture seule à cet utilisateur, et isoler les répertoires temporaires accessibles en écriture (`/tmp`).

---

## 2. Construction Multi-Étapes (*Multi-Stage Builds*)

- **Séparation Stricte Compilation / Exécution** :
  - **Stage `builder`** : Contient les compilateurs, SDKs, gestionnaires de paquets et dépendances de développement (`npm`, `cargo`, `maven`, `gcc`).
  - **Stage `runner`** : Repart d'une image de base minimale (*Alpine*, *Debian Slim* ou *Google Distroless*) et ne copie que les artefacts compilés (`dist/`, binaires exécutables, dépendances de production taillées).
- **Structure type multi-stage (Node.js)** :
  ```dockerfile
  # Étape 1 : Build
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build && npm prune --production

  # Étape 2 : Production Runtime
  FROM node:20-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  COPY --chown=node:node package*.json ./
  COPY --from=builder --chown=node:node /app/node_modules ./node_modules
  COPY --from=builder --chown=node:node /app/dist ./dist
  USER node
  EXPOSE 3000
  CMD ["node", "dist/main.js"]
  ```

---

## 3. Gestion des Signaux & Processus PID 1

- **Problème des Zombies & Arrêt Propre (Graceful Shutdown)** :
  - Dans un conteneur Docker, le processus principal s'exécute avec le PID 1.
  - Les runtimes comme Node.js ou Python ne gèrent pas nativement le moissonnage des processus enfants zombies (*zombie process reaping*) ni la transmission automatique des signaux système `SIGTERM` / `SIGINT` s'ils sont lancés via un shell `CMD npm start`.
- **Règles d'Exécution** :
  - Toujours utiliser la forme exécutable JSON pour `CMD` et `ENTRYPOINT` : `CMD ["node", "server.js"]` (et non `CMD node server.js` qui instancie un sous-shell `/bin/sh -c`).
  - Pour les conteneurs complexes, utiliser un init système léger comme `tini` ou `dumb-init` :
    ```dockerfile
    RUN apk add --no-cache tini
    ENTRYPOINT ["/sbin/tini", "--"]
    CMD ["node", "dist/main.js"]
    ```

---

## 4. Réduction de Surface d'Attaque & Optimisation du Cache

- **Fichier `.dockerignore` Obligatoire** :
  - Exclure systématiquement `.git`, `node_modules`, `tests`, `.env*`, `README.md`, logs et caches de compilation pour éviter de faire fuiter des secrets ou d'invalider inutilement le cache Docker.
- **Ordonnancement des Directives `COPY`** :
  - Copier d'abord les manifestes de dépendances (`package.json`, `go.mod`, `requirements.txt`) avant le code source afin d'exploiter la mise en cache des couches de dépendances.
- **Éphémérité & Systèmes de Fichiers en Lecture Seule** :
  - Prévoir la compatibilité avec l'option d'exécution `--read-only` (conteneur sans droit d'écriture sur son système de fichiers racine).
