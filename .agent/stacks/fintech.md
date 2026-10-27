# Stack d'Ingénierie Fintech & Systèmes Transactionnels

Ce guide regroupe les standards d'ingénierie incompressibles pour le développement d'applications financières, passerelles de paiement, Mobile Money et systèmes de comptabilité.

---

## 1. Règle d'Or de l'Arithmétique Monétaire

> [!CAUTION]
> **Interdiction absolue des nombres à virgule flottante (`float`, `double`, `Number` JS standard) pour manipuler des montants d'argent.**
> Les approximations binaires (`0.1 + 0.2 = 0.30000000000000004`) provoquent des pertes financières et des failles d'arrondi.

### Règles d'Implémentation
1. **Stockage en Unités Mineures (Cents / Centimes / Rép. entière)** :
   - Stocker tous les montants sous forme d'entiers (`BigInt`, `INTEGER` ou `BIGINT` en base de données).
   - Exemple : 100,50 EUR -> stocké `10050` (centimes).
   - Exemple : 5 000 XOF -> stocké `5000` (le franc CFA n'ayant pas de sous-unité usuelle, unité mineure = 1 XOF).
2. **Calculs Précis en Précision Arbitraire** :
   - Utiliser des bibliothèques dédiées (`decimal.js`, `bignumber.js` en Node/TS, `decimal` en Python, `BigDecimal` en Java).
   - Définir une stratégie d'arrondi explicite (arrondi bancaire demi-pair / *Half-Even Rounding*).

---

## 2. Grand Livre à Double Entrée (Double-Entry Ledger)

Dans tout système manipulant des fonds, l'état d'un solde ne doit jamais être calculé par une simple mise à jour directe d'une colonne `balance = balance + X`.

```
                    Transaction Bancaire / Transfert
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
[Ligne Débit (Compte Source)]               [Ligne Crédit (Compte Destination)]
      Montant : -5000                             Montant : +5000
            |                                           |
            +---------------------+---------------------+
                                  |
                                  v
                      Somme du Débit + Crédit = 0 (Équilibre Strict)
```

### Principes Clés
- **Immuabilité** : Une écriture comptable insérée ne doit **jamais** être mise à jour ni supprimée (`UPDATE` et `DELETE` interdits sur la table `ledger_entries`).
- **Équilibre Obligatoire** : Chaque transaction est composée d'au moins deux écritures (débit et crédit) dont la somme arithmétique est strictement égale à zéro.
- **Correction par Contre-Passation** : Toute correction d'erreur nécessite l'insertion d'une nouvelle transaction d'annulation ou de compensation.

---

## 3. Clés d'Idempotence et Prévention des Doubles Débits

Toute action financière initiée par un client HTTP doit être protégée par une clé d'idempotence unique (`Idempotency-Key`).

```typescript
// Exemple de vérification d'idempotence avec Redis
async function processPayment(req: Request, res: Response) {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Header Idempotency-Key manquant' });
  }

  const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
  if (existingResult) {
    // Renvoyer le résultat mémorisé sans réexécuter le débit
    return res.status(200).json(JSON.parse(existingResult));
  }

  // Acquisition d'un verrou distribué (Redlock / Mutex Redis)
  const lockAcquired = await redis.set(`lock:${idempotencyKey}`, '1', 'PX', 10000, 'NX');
  if (!lockAcquired) {
    return res.status(409).json({ error: 'Transaction en cours de traitement' });
  }

  try {
    const payment = await executeFinancialTransfer(req.body);
    await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(payment), 'EX', 86400); // 24h
    return res.status(201).json(payment);
  } finally {
    await redis.del(`lock:${idempotencyKey}`);
  }
}
```

---

## 4. Agrégateurs de Paiement & Mobile Money (FedaPay, KKiaPay, MTN, Moov, Orange)

L'intégration de passerelles de paiement tierces (particulièrement en Afrique de l'Ouest et Centrale) exige des garanties strictes de traitement réseau asynchrone.

### Architecture des Webhooks Sécurisés
1. **Vérification Systématique de la Signature HMAC** :
   - Ne jamais faire confiance à l'adresse IP d'origine seule.
   - Calculer le condensat HMAC SHA-256 du corps brut de la requête (`raw body` non parsé) avec le secret de webhook et comparer avec le header reçu (`X-Signature` ou équivalent) en temps constant (`crypto.timingSafeEqual`).
2. **Traitement Asynchrone Découplé** :
   - Répondre immédiatement `HTTP 200 OK` à l'agrégateur dès réception et stockage du webhook en file de messages (queue / Redis).
   - Les agrégateurs relancent agressivement les webhooks si la réponse tarde plus de 3 à 5 secondes.
3. **Réconciliation Périodique (Polling de Contrôle)** :
   - Ne jamais se fier exclusivement aux webhooks : un problème réseau peut entraîner une perte de notification.
   - Mettre en place un worker périodique de réconciliation qui interroge l'API de l'agrégateur pour vérifier le statut de toutes les transactions restées en statut `PENDING` depuis plus de 15 minutes.

---

## 5. Checklist Sécurité & Conformité Fintech
- [ ] Aucun montant manipulé avec des nombres flottants (stockage en entiers d'unités mineures).
- [ ] Journalisation stricte sans aucune donnée de carte bancaire (PAN, CVV) conforme PCI-DSS.
- [ ] Transactions de débit exécutées dans un bloc transactionnel SQL avec niveau d'isolation adéquat (`SERIALIZABLE` ou `READ COMMITTED` avec `SELECT ... FOR UPDATE`).
- [ ] Clé d'idempotence exigée sur tous les endpoints de création financière (`POST /payments`, `POST /transfers`).
- [ ] Signatures cryptographiques validées en temps constant sur tous les webhooks entrants.
- [ ] Procédure automatisée de réconciliation périodique en place.
