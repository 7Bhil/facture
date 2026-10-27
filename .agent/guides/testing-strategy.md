# Guide de Stratégie de Test Moderne

> **Sources de référence condensées** : `references/javascript-testing-best-practices`.

Ce guide synthétise les règles fondamentales pour concevoir une suite de tests rapide, fiable, maintenable et non fragile.

---

## 1. La Pyramide Pragmatique : Tester le Comportement, Pas les Mocks

```text
       /\
      /  \      E2E (Parcours critiques uniquement - ~10%)
     /----\
    /      \    Tests d'Intégration (Cœur de la confiance - ~60%)
   /--------\   (Base de données réelle en mémoire/Docker, vraies routes HTTP)
  /          \
 /------------\ Tests Unitaires Purs (Domaine métier complexe - ~30%)
```

### La Règle d'or de la boîte noire (Black-Box Testing)
- **Tester le résultat observable**, pas les variables ou méthodes privées.
- **Ne pas tester les détails d'implémentation** : si vous renommez une méthode interne sans changer le contrat public de sortie, les tests ne doivent **pas** casser.
- **Minimiser les mocks** : Ne mocker que les frontières système externes lentes ou payantes (envoi d'e-mails, passerelles Stripe, SMS). Laisser la base de données et l'ORM tourner dans un environnement de test isolé.

---

## 2. Anatomie d'un Test Parfait : Structure AAA

Chaque test doit être divisé en 3 blocs visuels nets : **Arrange**, **Act**, **Assert**.

```typescript
describe('OrderService.createOrder', () => {
  it('should apply discount and deduct stock when cart is valid', async () => {
    // 1. Arrange (Préparation minimale)
    const initialStock = 10;
    const product = await testFactory.createProduct({ stock: initialStock, price: 100 });
    const user = await testFactory.createUser({ discountRate: 0.1 });

    // 2. Act (Action unique exécutée)
    const order = await orderService.createOrder({
      userId: user.id,
      items: [{ productId: product.id, quantity: 2 }],
    });

    // 3. Assert (Vérification des sorties et effets de bord observables)
    expect(order.totalAmount).toBe(180); // (100 * 2) - 10%
    const updatedProduct = await db.product.findUnique({ where: { id: product.id } });
    expect(updatedProduct?.stock).toBe(initialStock - 2);
  });
});
```

---

## 3. Bonnes Pratiques de Nommage et Robustesse

### 3.1 Nommage explicite selon le pattern Given-When-Then
-  `it('test error', ...)`
-  `it('create order works', ...)`
-  `it('should return 400 with VALIDATION_ERROR when email is malformed', ...)`
-  `it('should throw InsufficientStockError when quantity exceeds inventory', ...)`

### 3.2 Indépendance absolue des tests
- Chaque test doit pouvoir être exécuté seul, dans n'importe quel ordre.
- Nettoyage automatique avant chaque exécution (`beforeEach`) :
```typescript
beforeEach(async () => {
  await testDb.cleanAllTables();
});
```

---

## 4. Cycle de Vie des Tests : Quand en Ajouter, Quand en Supprimer ?

Un ingénieur senior ne se contente pas d'ajouter des tests à l'aveugle ; il maintient activement la pertinence du harnais de test et élimine le bruit.

```
                              Événement de Code
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
[Nouvelle Règle / Bugfix]                                [Refactoring / Dépréciation]
         |                                                         |
         v                                                         v
Action : AJOUTER                                         Action : ÉVALUER / SUPPRIMER
- 1 test nominal (happy path)                            - Le comportement est-il obsolète ?
- 2 à 3 cas limites (edge cases)                           --> OUI : Supprimer le test.
- 1 test de reproduction (anti-régression)               - Le test est-il un doublon d'implémentation ?
                                                           --> OUI : Supprimer ou fusionner.
                                                         - Le comportement est inchangé ?
                                                           --> CONSERVER : Le test doit rester vert.
```

### 4.1 Quand l'Agent DOIT Ajouter un Test
1. **Nouvelle fonctionnalité (`feat`)** :
   - Tout nouveau cas d'utilisation métier requiert au minimum son test nominal et la couverture de ses cas limites (valeurs nulles, entrées invalides, droits insuffisants).
2. **Correction de bug (`fix`)** :
   - **Règle absolue** : Écrire d'abord le test unitaire ou d'intégration qui reproduit fidèlement le bug (le test doit échouer au rouge).
   - Appliquer le correctif de code.
   - Valider que le test passe au vert. Ce test devient le garant anti-régression permanent.
3. **Refactoring de code sans couverture (Phase 0)** :
   - Écrire des **tests de caractérisation** préalables pour figer le comportement observé avant de réorganiser l'architecture interne.

### 4.2 Quand l'Agent DOIT Supprimer ou Retirer un Test
La prolifération de tests inutiles ralentit la CI et produit des faux positifs. Un agent senior doit supprimer un test dans les situations suivantes :
1. **Fonctionnalité dépréciée ou supprimée** :
   - Si une route ou une règle métier est retirée du périmètre produit, les tests correspondants doivent être immédiatement supprimés (ne jamais laisser de tests commentés).
2. **Test couplé à un détail d'implémentation interne (Test fragile)** :
   - Si un test vérifie l'ordre d'appel d'une fonction privée ou mocke excessivement la structure interne au lieu du comportement externe, il doit être remplacé par un test d'intégration boîte noire ou supprimé.
3. **Doublons redondants** :
   - Plusieurs tests testant strictement la même assertion avec des données insignifiantes doivent être consolidés (ex: tester 5 variantes de chaînes valides sans valeur ajoutée de cas limite).
4. **Tests de caractérisation temporaires** :
   - Dès qu'un composant patrimonial est refactorisé et que les nouveaux tests unitaires/intégration cibles sont en place, le harnais de caractérisation temporaire doit être purgé.
