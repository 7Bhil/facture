# Checklist 01 : Architecture Logicielle & Conception de Systèmes

*Sources d'inspiration : `references/system-design-primer`, `references/bulletproof-react`*

Cette checklist permet de s'assurer que chaque décision de conception respecte les standards d'évolutivité, de découplage et de maintenabilité à long terme.

---

## 1. Découpage et Séparation des Responsabilités (SoC)

- [ ] **Couche Métier / Domaine isolée** :
  - La logique métier centrale ne dépend ni du framework web (Express, Fastify, Next.js), ni du système de persistance (Prisma, TypeORM, Mongoose).
  - Les règles de gestion sont testables sans instancier de serveur HTTP ni de base de données.
- [ ] **Couche Transport / Contrôleurs mince** :
  - Les contrôleurs se limitent à : valider le format de la requête -> appeler le service/cas d'usage -> mapper et formater la réponse.
  - Aucune logique métier complexe ou requête SQL directe dans les contrôleurs.
- [ ] **Modularité Front-end (Feature-based)** :
  - Organisation par fonctionnalités métier (`features/auth`, `features/billing`) plutôt que par type technique (`components/`, `reducers/`).
  - Chaque module expose une API publique claire via son fichier index (`index.ts`).

---

## 2. Inversion de Dépendances & Découplage

- [ ] **Dépendre des abstractions, pas des concrétions** :
  - Les services externes (passerelles de paiement, envoi d'emails, stockage S3) sont encapsulés derrière des interfaces/ports.
  - Permet le remplacement aisé ou le mock complet lors des tests.
- [ ] **Gestion des états globaux vs locaux (Front-end)** :
  - L'état de serveur (données distantes) est géré par des outils dédiés (TanStack Query, SWR, RTK Query) avec cache et invalidation.
  - L'état d'interface (UI state) reste au plus près du composant consommateur.

---

## 3. Résilience et Tolérance aux Pannes (System Design)

- [ ] **Idempotence des opérations critiques** :
  - Les opérations d'écriture/modification (notamment paiements, commandes) supportent les réessais grâce à une clé d'idempotence (`Idempotency-Key`).
- [ ] **Timeouts et Circuit Breakers** :
  - Tout appel réseau ou RPC externe dispose d'un timeout explicite (ex: 3s à 5s max).
  - En cas de défaillance répétée d'un tiers, un mécanisme de repli (fallback ou circuit breaker) évite d'épuiser le pool de threads ou connexions.
- [ ] **Gestion de la concurrence** :
  - Utilisation de verrous optimistes (`version`/`updatedAt`) ou pessimistes pour prévenir les *race conditions* sur les ressources partagées.
- [ ] **Pattern Outbox Transactionnel** :
  - Les événements asynchrones liés à une mutation métier sont persistés dans la même transaction SQL que la donnée, jamais émis en direct vers un broker.
- [ ] **Limitation de Débit (Rate Limiting)** :
  - Les endpoints sensibles (login, mot de passe oublié, paiement, webhooks) sont protégés par un rate limiter (Redis sliding window / token bucket).
