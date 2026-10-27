<!--
  FICHIER GÉNÉRÉ AUTOMATIQUEMENT VIA scripts/build-adapters.py
  Source unique de vérité : core/RULES.md et presets/7bhil.md
  Ne modifiez pas ce fichier directement.
-->

# Configuration de l'Agent : Standard Universel (Agents Autonomes, Windsurf, Cline, Aider)

## Invariants du Core (Règles Universelles)
# CORE RULES : POSTURE D'INGENIEUR LOGICIEL SENIOR

Ce document est le contrat universel d'ingénierie logicielle pour tout agent d'IA intervenant sur le projet.
Ces règles sont indépendantes des préférences personnelles d'un développeur ou d'une organisation : elles reflètent les standards industriels incompressibles d'ingénierie, de sûreté et de propreté logicielle.

> [!IMPORTANT]
> **RÈGLE DU PREMIER RÉFLEXE (PROPORTIONNÉE AU BESOIN)** :
> 1. **Une fois par session** (premier tour, ou après une compaction de contexte) : lire `BRAIN.md` et `.agent/memory/`. Ne pas les relire aux tours suivants.
> 2. **Avant toute modification de fichier** : formuler un diagnostic explicite (cause racine, périmètre d'impact, fichiers concernés) et appliquer les gardes-fous (pas de `any`, zéro invention d'API, tests préalables, sécurité par défaut).
> 3. **En fin d'intervention ayant modifié des fichiers** : mettre à jour `.agent/memory/current-state.md`. Une question, une explication ou un avis sans modification ne déclenche aucune écriture.
> 4. **Mémoire bornée** : `current-state.md` reste sous 40 lignes. Il décrit l'état présent, pas l'historique (celui-ci est dans `git log`).

---

## 1. Protocole d'Exécution en 5 Phases

### Phase 0 : Exploration & Onboarding (Prise en Main de l'Existant)
- **Consulter le protocole d'onboarding** : Appliquer [.agent/guides/onboard-codebase.md](.agent/guides/onboard-codebase.md).
- **Ligne de base & Caractérisation** : Exécuter la suite de tests et de linters existante avant toute modification. Écrire des tests de caractérisation en l'absence de couverture suffisante avant tout refactoring.
- **Respect de l'existant** : Se conformer aux conventions locales en place. Inspecter `git log` et `git blame` pour appréhender les raisons d'être historiques (Règle de Chesterton).

### Phase 1 : Investigation & Diagnostic (Avant toute modification)
- **Comprendre le contexte global** : Inspecter la structure du projet, les conventions de code existantes, les linters et configurations de compilation.
- **Isoler la cause racine** : En cas d'anomalie, ne pas traiter le symptôme de surface. Identifier le mécanisme exact défaillant.
- **Évaluer les impacts** : Identifier les modules, tests ou contrats d'API impactés par le changement envisagé.

### Phase 2 : Planification & Arbitrage Architectural
- Privilégier la solution la plus simple, lisible et découplée (YAGNI, KISS).
- Vérifier la conformité aux principes SOLID et à la séparation des responsabilités (domaine métier / transport / persistance).
- Prévoir la gestion des cas limites (*edge cases*) : valeurs nulles/undefined, timeouts réseau, pannes de services tiers, permissions non accordées.
- **Arbitrage ADR** : Si la décision modifie la structure architecturale ou introduit une nouvelle dépendance structurante, consigner un ADR dans `docs/decisions/`.

### Phase 3 : Implémentation & Clean Code
- **Nommage explicite** : Nommer les variables, types et fonctions selon leur intention métier, sans abréviations cryptiques.
- **Typage strict** : Pas de types évasifs (`any`, types imprécis). Modéliser explicitement les données.
- **Fail Fast & Gestion des Erreurs** : Valider les entrées aux frontières du système (Zod/Valibot/Joi). Utiliser des erreurs typées ou des patterns Result.
- **Zéro dette technique** : Pas de code mort, pas de commentaires de code obsolètes, pas de hacks temporaires non documentés.

### Phase 4 : Validation & Auto-Revue
- **Tests Automatisés** : Ajouter ou mettre à jour les tests (unitaires, intégration) couvrant le cas nominal et les cas d'erreur. Suivre les règles du cycle de vie des tests ([.agent/guides/testing-strategy.md](.agent/guides/testing-strategy.md)).
- **Checklist Sécurité & Confidentialité** :
  - Les entrées utilisateurs sont-elles assainies et validées ?
  - Aucune information sensible (token, mot de passe, PII/RGPD) n'apparaît dans les logs ou les réponses d'erreurs ?
  - L'accès est-il vérifié au niveau métier (autorisation BOLA/IDOR) et non uniquement au niveau du router ?

---

## 2. Principes Incompressibles (Anti-Hallucination & Anti-Dette)

1. **Anti-Hallucination Formelle** :
   - Interdiction formelle d'inventer des API, méthodes, bibliothèques ou imports inexistants.
   - Toujours inspecter le descripteur de dépendances (`package.json`, `Cargo.toml`, etc.) et la signature réelle des fichiers avant d'utiliser une fonction.
   - Si une bibliothèque ou méthode n'existe pas, vérifier la documentation ou proposer son installation explicite.
2. **Tolérance Zéro pour la Dette Technique** :
   - Aucun hack temporaire sans ticket ou issue documentée.
   - Pas de code mort, de variables orphelines, ni de blocs commentés obsolètes.
   - Typage strict : bannissement total du type `any` et des assertions aveugles (`as unknown as T`).
3. **Sécurité par Défaut** :
   - Contrôle d'accès basé sur les rôles et contrôle de propriété (*Broken Object Level Authorization - BOLA*).
   - Protection contre les injections (requêtes préparées / ORM stricts).
   - Protection CSRF, CORS restrictif, headers de sécurité (Helmet/CSP).
4. **Respect des Données Personnelles (RGPD)** :
   - Minimisation des données collectées.
   - Ne jamais persister ni journaliser de données identifiantes ou sensibles sans nécessité absolue et chiffrement approprié.

---

## 3. Direction Artistique & UI (Système Positif)
- Si le projet comporte une interface utilisateur, l'agent doit se conformer au cadre défini dans `DESIGN.md`.
- Interdiction formelle des styles "IA génériques" (dégradés fluo arbitraires violet/indigo, glassmorphism non demandé).
- Respect des classes sémantiques configurées et des variables CSS (zéro couleur arbitraire codée en dur).
- Chaque composant interactif doit implémenter formellement ses 4 états : *Loading* (squelettes), *Nominal*, *Empty*, et *Error* (avec bouton de réessai).

---

## 4. Préférences Locales du Projet
Pour toutes les conventions spécifiques au projet (langue des commits, politique de branches Git, outils de linting), l'agent doit lire et respecter la configuration déclarée dans `.agent/config.yml` et les préférences documentées dans `.agent/memory/user.md`.

---
## Préférences & Conventions Locales
# Préférences Utilisateur et Conventions Spécifiques : 7Bhil

Ce fichier documente le profil et les préférences retenues pour le compte et les projets de **7Bhil**.
Ces préférences s'appliquent en complément des règles universelles de `core/RULES.md` et sont configurées par défaut dans `.agent/config.yml`.

---

## 1. Conventions Git & Intégration
- **Langue des Commits** : Rédigés obligatoirement en **français**, préfixés par convention (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `style: ...`, `chore: ...`).
- **Stratégie de Branches & Push** :
  - Branche principale de publication / production : `main`. **Seul l'utilisateur fait des pushs sur `main`**. L'agent a l'interdiction formelle de merge ou push sur `main` sans demande explicite.
  - Branche d'intégration continue de développement : `developp`.
  - Branches de travail thématiques : `feature/*`, `fix/*`, `refactor/*`.
  - Toute branche de travail terminée et validée est fusionnée par merge commit (`--no-ff`) sur `developp`.

---

## 2. Style, UI & Identité Visuelle
- **Source unique de vérité** : Variables CSS configurées dans `global.css` (ou `globals.css`) et tokens déclarés dans `tailwind.config.ts` / `tailwind.config.js`.
- **Zéro couleur codée en dur** : Aucune chaîne hexadécimale arbitraire ou rgb en dur dans les composants.
- **Sobriété d'Entreprise** : Interfaces épurées, typographie sans-serif neutre, composants basés sur Radix UI / shadcn/ui.

---

## 3. Sobriété Textuelle & Zéro Émoji
- **Interdiction formelle des émojis** : Aucun émoji dans le code, les commentaires, la documentation, les messages de commit ou les réponses conversationnelles.
- **Rédaction Anti-Slop** : Proscription des formules creuses, du hedging (`"il convient de noter"`), de la fausse connivence et de l'emphase dramatique. Contrôle via `scripts/audit-slop.py`.

---

## 4. Stacks Techniques Privilégiées
- Front-end : Next.js (App Router, Server Components), Tailwind CSS, TanStack Query.
- Mobile : React Native / Expo.
- Backend : Node.js (NestJS / Express) avec typage strict TypeScript, ou Python (FastAPI / Pydantic v2).
- Persistance & Données : PostgreSQL, Prisma / Drizzle, modélisation 3NF et conformité ACID.
- Fintech & Paiement : Unités mineures entières, grand livre à double entrée, intégration Mobile Money (FedaPay, KKiaPay) avec webhooks signés.
