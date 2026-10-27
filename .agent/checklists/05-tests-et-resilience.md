# Checklist 05 : Stratégie de Tests, Qualité & Résilience

*Sources d'inspiration : `references/javascript-testing-best-practices`*

---

## 1. Pyramide des Tests & Choix Stratégique

- [ ] **Tests Unitaires ciblés sur le domaine métier pur** :
  - Rapides, isolés, sans I/O ni réseau.
  - Couvrent les calculs, transitions d'états, règles de validation et algorithmes complexes.
- [ ] **Tests d'Intégration réalistes (Priorité Senior)** :
  - Tester les interactions réelles (ex: contrôleur -> service -> base de données éphémère ou testcontainers).
  - Éviter de sur-mocker l'ORM ou les bases de données : tester le comportement global du système plutôt que les détails d'implémentation.
- [ ] **Tests E2E / Contrat pour les flux critiques** :
  - Couvrir les parcours critiques (ex: parcours d'achat, authentification, paiement).

---

## 2. Anatomie d'un Bon Test (Pattern AAA)

- [ ] **Arrange - Act - Assert clair** :
  - **Arrange** : Préparer les données de test minimales nécessaires.
  - **Act** : Exécuter l'action unique testée.
  - **Assert** : Vérifier le résultat et les effets de bord attendus.
- [ ] **Nommage explicite des scénarios de test** :
  - Format clair : `it('should reject order when stock is insufficient', ...)` plutôt que `it('test order error', ...)`.
- [ ] **Couverture des cas d'erreur et limites (Edge Cases)** :
  - Ne pas se contenter du *happy path*.
  - Tester : chaînes vides, entrées malicieuses, tableaux vides, limites numériques, erreurs de connexion réseau, requêtes concurrentes.

---

## 3. Maintenabilité des Tests

- [ ] **Tests boîtes noires (Black-box testing)** :
  - Tester le comportement public et le résultat final, jamais les méthodes privées ou variables internes.
- [ ] **Indépendance des tests** :
  - Chaque test s'exécute de façon autonome.
  - Remise à zéro de l'état (base de données, mocks) avant chaque test (`beforeEach`).

---

## 4. Arbitrage Senior : Quand Ajouter et Quand Soustraire des Tests

- [ ] **Quand ajouter des tests** :
  - `feat` : Ajout obligatoire d'un test nominal et d'au moins 2 cas limites (null, vide, accès refusé).
  - `fix` : Reproduction préalable du bug par un test en échec (rouge) avant écriture du correctif (vert).
  - Refactor sans tests : Écriture de tests de caractérisation préalables (Phase 0).
- [ ] **Quand soustraire (supprimer) des tests** :
  - Code déprécié : Toute règle métier ou route retirée doit voir ses tests supprimés immédiatement (jamais commentés).
  - Couplage interne : Supprimer les tests qui espionnent des méthodes privées ou mockent excessivement l'implémentation.
  - Doublons redondants : Fusionner les tests sans valeur ajoutée pour maintenir une suite d'exécution rapide.
  - Tests de caractérisation : Les purger dès que les tests cibles réels sont en place.
