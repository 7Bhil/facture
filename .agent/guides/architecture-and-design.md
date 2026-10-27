# Guide d'Architecture Système & Scalabilité

> **Sources de référence condensées** : `references/system-design-primer`, `references/bulletproof-react`.

Ce guide définit les patterns d'architecture front-end et back-end indispensables pour construire des systèmes robustes, découplés et scalables.

---

## 1. Architecture Front-End Modulaire (*Feature-Based Structure*)

Inspiré de **Bulletproof React**, le code front-end ne doit pas être découpé par type technique (`components/`, `hooks/`, `types/`) mais par **domaine métier**.

```text
src/
├── app/                  # Configuration du routeur et providers globaux
├── components/           # Composants UI partagés (Button, Modal, Input)
├── lib/                  # Instances préconfigurées (axios, react-query)
└── features/             # Modules métier étanches
    ├── auth/
    │   ├── api/          # Requêtes (loginUser, getUser) & mutations
    │   ├── components/   # Formulaires et composants spécifiques auth
    │   ├── hooks/        # Hooks spécifiques auth (useAuthSession)
    │   ├── types/        # Schémas et interfaces auth
    │   └── index.ts      # API publique du module (seul point d'entrée autorisé)
    └── billing/
```

### Règle d'or de dépendance
Les modules internes d'une *feature* ne doivent jamais importer directement les entrailles privées d'une autre *feature*. Tout import inter-modules passe impérativement par le `index.ts` public :
```typescript
//  VRAI : Consommation propre de l'API publique
import { useCurrentUser } from '@/features/auth';

//  FAUX : Dépendance couplée sur un fichier interne privé
import { useCurrentUser } from '@/features/auth/hooks/internal/useCurrentUserPrivate';
```

---

## 2. Patterns de Résilience & Scalabilité Back-End

### 2.1 Clé d'Idempotence (Safe Retries)
Pour toute action financière, de création ou de modification critique, accepter un header `Idempotency-Key` pour autoriser les réessais réseau sans créer de doublons.

```typescript
export async function handlePaymentWithIdempotency(key: string, payload: PaymentDto) {
  const cachedResult = await redis.get(`idempotency:${key}`);
  if (cachedResult) {
    return JSON.parse(cachedResult); // Retourne la réponse initiale sans refacturer
  }

  const result = await paymentGateway.charge(payload);
  await redis.set(`idempotency:${key}`, JSON.stringify(result), 'EX', 86400); // 24h
  return result;
}
```

### 2.2 Stratégie de Caching & Invalidation (Cache-Aside Pattern)
1. Chercher dans le cache Redis.
2. Si *hit* : renvoyer immédiatement.
3. Si *miss* : interroger la base de données, alimenter le cache avec un TTL raisonnable, puis renvoyer.
4. Lors de chaque mise à jour ou suppression : invalider ou purger immédiatement la clé de cache correspondante.

```typescript
async function getProductById(id: string): Promise<Product> {
  const cacheKey = `product:${id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const product = await db.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError('Product', id);

  await redis.set(cacheKey, JSON.stringify(product), 'EX', 3600); // 1h
  return product;
}
```

### 2.3 Circuit Breaker & Fallback
Tout appel vers un service tiers ou API externe doit disposer :
- D'un **Timeout strict** (ex: 3 000 ms).
- D'un **mécanisme de repli** lorsque le service externe tombe, afin de ne pas bloquer les requêtes utilisateurs locales.

### 2.4 Pattern Outbox Transactionnel (Événements Fiables)
Ne jamais publier directement sur un broker (Kafka, RabbitMQ) au milieu d'une transaction SQL : si le broker échoue, la transaction est corrompue ou le message perdu.
- Enregistrer le message métier dans une table SQL `outbox` dans la même transaction ACID que la mutation.
- Un worker asynchrone distinct dépile la table `outbox`, publie vers le broker, puis marque le message comme traité.

```typescript
// Transaction ACID atomique : donnée métier + événement outbox
await db.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.outbox.create({
    data: {
      eventType: 'ORDER_CREATED',
      payload: JSON.stringify({ orderId: order.id, total: order.total }),
      status: 'PENDING'
    }
  });
});
```

### 2.5 Limitation de Débit (Rate Limiting Applicatif)
Protéger les routes d'authentification et de paiement via un algorithme à fenêtre glissante ou Token Bucket appuyé sur Redis.

```typescript
export async function assertRateLimit(identifier: string, limit = 10, windowSec = 60) {
  const key = `ratelimit:${identifier}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSec);
  }
  if (current > limit) {
    throw new TooManyRequestsError('Limite de requêtes atteinte. Réessayez plus tard.');
  }
}
```
