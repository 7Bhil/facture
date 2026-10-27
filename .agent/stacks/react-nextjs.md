# Règles Senior : React, Next.js (App Router) & TypeScript

> **Sources de référence** : `references/bulletproof-react`, `references/clean-code-javascript`, Next.js Architecture Guidelines.

---

## 1. Découpage Modulaire par Domaine (*Feature-Driven*)

- Organiser le code métier dans `src/features/<nom-du-domaine>/` :
  - `components/` : Composants graphiques spécifiques au domaine.
  - `api/` : Points d'accès aux requêtes et mutations (requêtes React Query / Server Actions).
  - `hooks/` : Hooks d'état local ou de coordination du domaine.
  - `types/` : Définitions TypeScript strictes des entités et contrats.
  - `index.ts` : Point d'entrée public de la feature exportant uniquement l'interface nécessaire.
- Interdiction formelle d'importer directement les fichiers internes d'une autre feature sans passer par son `index.ts` public.

---

## 2. Server vs Client Components (Next.js App Router)

- **Composants Serveur par Défaut (RSC)** :
  - Conserver les composants côté serveur par défaut pour réduire le bundle JavaScript transmis au navigateur, améliorer le TTFB et masquer les accès aux bases de données ou clés API.
- **Frontière Client Restreinte (`'use client'`)** :
  - N'ajouter la directive `'use client'` qu'aux feuilles terminales de l'arbre nécessitant des interactions utilisateur (`onClick`, `onChange`), des états locaux (`useState`, `useReducer`) ou des APIs navigateur (`localStorage`, `window`).
  - Passer les Server Components comme `children` des Client Components lorsque cela est nécessaire pour préserver le rendu serveur de la structure globale.

---

## 3. Runtimes, Caching & Middlewares Next.js

- **Edge Runtime vs Node.js Runtime** :
  - Spécifier explicitement le runtime adapté selon les contraintes de latence et de compatibilité :
    - `export const runtime = 'nodejs';` par défaut pour disposer des APIs Node complètes et des drivers de base de données natifs.
    - `export const runtime = 'edge';` pour les routes de redirection ultra-légères, géographiquement distribuées et sans dépendance lourde aux modules natifs Node.
- **Stratégie de Caching & Revalidation Déterministe** :
  - Maîtriser le cache du fetch Next.js :
    - Statique par défaut (`force-cache`).
    - Dynamique pour les données personnalisées (`cache: 'no-store'` ou `export const dynamic = 'force-dynamic';`).
    - Revalidation périodique (`next: { revalidate: 60 }`) ou sur demande via `revalidateTag()` / `revalidatePath()`.
- **Règles pour le Middleware Next.js (`middleware.ts`)** :
  - Le middleware s'exécute sur le Edge Runtime en amont de chaque requête correspondante (`matcher`).
  - Y restreindre les opérations aux vérifications rapides de session, redirections d'authentification, ajouts d'en-têtes HTTP de sécurité ou géolocalisation.
  - Ne jamais exécuter de requêtes SQL lourdes ou d'opérations bloquantes dans `middleware.ts`.

---

## 4. Gestion d'État & Validation des Formulaires

- **État Serveur vs État Client** :
  - Utiliser TanStack Query (React Query) ou SWR pour synchroniser l'état distant, gérer les requêtes en arrière-plan et la déduplication.
  - Réserver Zustand ou React Context aux états applicatifs purement UI (thème sombre, panneaux latéraux, préférences d'affichage).
- **Formulaires Robustes & Server Actions** :
  - Valider systématiquement les données avec Zod (`zodResolver`) combiné à React Hook Form côté client.
  - Dans les *Server Actions*, valider à nouveau l'intégralité du payload via le schéma Zod côté serveur avant tout traitement ou persistance en base.
