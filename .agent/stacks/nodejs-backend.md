# Règles Senior : Node.js, Express & NestJS Backend

> **Sources de référence** : `references/nodebestpractices`, `references/API-Security`, `references/ASVS`.

---

## 1. Architecture en Couches Strictes & Modularité

- **Controller** : Valide les entrées (`req.body`, `req.params`) via Zod ou DTOs class-validator et transmet le flux au Service. Ne contient aucune logique métier ni requête SQL/ORM.
- **Service / Use Case** : Logique métier pure, sans dépendance directe à l'objet `req` ou `res` d'Express ou aux interfaces de transport.
- **Repository / DAL** : Accès aux données avec ORM (Prisma, Drizzle, TypeORM) ou requêtes typées. Encapsule les requêtes de base de données.

---

## 2. Spécificités NestJS (Architecture Entreprise)

- **Modularité par Domaine (`@Module`)** :
  - Découper l'application en modules autonomes et isolés (`AuthModule`, `BillingModule`, `UserModule`).
  - N'exporter dans `exports: [...]` que les Providers indispensables aux autres modules afin de maintenir un couplage faible.
- **Injection de Dépendances & Cycle de Vie** :
  - Utiliser l'injection par constructeur avec des jetons typés (`@Inject(TOKEN)` pour les interfaces).
  - Privilégier le scope par défaut (*Singleton Scope*). N'utiliser le scope par requête (*Request Scope*) qu'en cas de nécessité absolue (ex: isolation multi-tenant dynamique), en raison du surcoût d'instanciation sur chaque appel.
- **Pipes, Guards & Interceptors** :
  - **Pipes** : Validation et transformation globale des requêtes via `ValidationPipe` avec options `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
  - **Guards** : Authentification et autorisation exécutées en amont des contrôleurs (`AuthGuard`, `RolesGuard`).
  - **Interceptors** : Gestion transversale de la journalisation, mesure des temps de réponse ou sérialisation (`ClassSerializerInterceptor`).

---

## 3. Spécificités Express.js (Architecture Épurée)

- **Gestion des Erreurs Asynchrones** :
  - En Express 4, utiliser `express-async-errors` ou un middleware wrapper d'erreurs pour intercepter toute promesse rejetée sans blocage de l'Event Loop.
  - Placer le middleware global de traitement des erreurs `(err, req, res, next)` en toute fin de chaîne de routing.
- **Découpage des Routes et Middlewares** :
  - Déclarer des routeurs dédiés (`express.Router()`) par ressource et les monter sur des préfixes d'URL clairs (`/api/v1/...`).
  - Valider strictement les schémas d'entrée au niveau du middleware de route avant d'atteindre le contrôleur.

---

## 4. Sécurité & Robustesse de Production

- **Sécurité Réseau & HTTP** :
  - En-têtes sécurisés via `helmet()`.
  - Configuration CORS restrictive avec whitelist d'origines précises (aucun `origin: '*'` sur des API authentifiées).
  - Limitation de débit via `express-rate-limit` ou `@nestjs/throttler` pour contrer les attaques par force brute sur les routes sensibles (`/auth/login`, `/auth/reset-password`).
- **Gestion des Signaux & Arrêt Contrôlé (Graceful Shutdown)** :
  - Écouter `SIGTERM` et `SIGINT` pour arrêter d'accepter de nouvelles requêtes HTTP, drainer les requêtes en cours, fermer les connexions de base de données et libérer les clients Redis.
