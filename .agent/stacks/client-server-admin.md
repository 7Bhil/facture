# Stack d'Architecture : Client / Server / Admin avec Contrat Partagé (Single Source of Truth)

Ce guide définit le standard d'ingénierie obligatoire pour tout projet découpé en applications frontales multiples et backend avec persistance.

---

## 1. Arborescence du Projet

L'ensemble des composants applicatifs vit dans un monorepo pragmatique sans usine à gaz de packaging :

```text
mon-projet/
├── client/                     # Application Web publique (Next.js / React)
├── admin/                      # Dashboard d'administration (Back-office, KPIs, actions staff)
├── server/                     # API Backend (Node.js/Nest/Fastify ou Python/FastAPI)
├── shared/                     # Source Unique de Vérité (Contrat d'API & types partagés)
│   ├── contracts/
│   │   ├── api-routes.ts       # Constantes d'URL et méthodes HTTP
│   │   └── user.contract.ts    # Schémas de validation (Zod) et DTOs
│   └── index.ts                # Point d'exportation unique (@shared)
├── AGENTS.md                   # Instructions agent universelles
├── BRAIN.md                    # Boussole opérationnelle
└── .agent/                     # Harnais d'ingénierie masqué (guides, checklists, mémoire)
```

---

## 2. La Règle d'Or : Zéro URL ou Payload Codé en Dur

### 2.1 Déclaration dans `shared/`
Tout endpoint et son contrat de validation sont définis **une seule fois** dans `shared/` :

```typescript
// shared/contracts/user.contract.ts
import { z } from 'zod';

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().min(5),
});

export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>;

export const USER_ROUTES = {
  ADMIN_UPDATE_STATUS: (userId: string) => `/api/v1/admin/users/${userId}/status`,
} as const;
```

### 2.2 Consommation Backend (`server/`)
Le serveur valide impérativement les requêtes entrantes avec le schéma partagé :

```typescript
// server/src/controllers/admin-user.controller.ts
import { UpdateUserStatusSchema } from '@shared';

export async function handleUpdateStatus(req, res) {
  // Validation stricte au point d'entrée
  const payload = UpdateUserStatusSchema.parse(req.body);
  await userService.updateStatus(req.params.id, payload);
  res.status(200).json({ success: true });
}
```

### 2.3 Consommation Frontend (`admin/` ou `client/`)
Le front-end n'écrit jamais d'URL littérale :

```typescript
// admin/src/features/users/api/update-status.ts
import { USER_ROUTES, UpdateUserStatusDto } from '@shared';

export async function mutateUserStatus(userId: string, data: UpdateUserStatusDto) {
  // L'URL et le type de données sont garantis par le compilateur TypeScript
  return apiClient.patch(USER_ROUTES.ADMIN_UPDATE_STATUS(userId), data);
}
```

---

## 3. Configuration des Chemins TypeScript (`tsconfig.json`)

Pour que `client/`, `admin/` et `server/` importent `@shared` sans étape de compilation intermédiaire ni publication npm, chaque application configure l'alias natif dans son `tsconfig.json` :

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared": ["../shared/index.ts"],
      "@shared/*": ["../shared/*"]
    }
  }
}
```

---

## 4. Garanties & Gardes-Fous

1. **Vérification de parité statique** : Lors de toute exécution de `npm run build` ou `npx tsc --noEmit` à la racine ou dans un sous-dossier, toute divergence de nommage de champ ou d'URL lève immédiatement une erreur bloquante.
2. **Périmètre d'intervention de l'agent** :
   - Quand l'agent modifie une route sur le serveur, il doit obligatoirement mettre à jour `shared/` dans le même commit.
   - L'agent a l'interdiction de créer un nouvel appel API dans `client/` ou `admin/` sans que son contrat n'existe préalablement dans `shared/`.
