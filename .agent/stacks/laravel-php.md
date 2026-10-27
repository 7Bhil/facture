# Règles Senior : PHP & Laravel

> **Standards de référence** : PHP 8.2+, Laravel 10 / 11, PSR-12, PSR-4, OWASP Top 10.

---

## 1. Architecture Applicative & Conteneur de Services

- **Séparation des Responsabilités (Clean Controllers)** :
  - Les contrôleurs doivent rester minces (*Skinny Controllers*). Leur rôle se limite à valider la requête entrante et déléguer le travail.
  - Déporter la logique métier complexe dans des classes d'actions dédiées (*Action Classes* / *Single Action Controllers* invokables) ou des Services injectés.
  - Déporter les requêtes volumineuses et la logique de sélection dans des *Query Builders* dédiés ou des *Eloquent Scopes*.
- **Form Requests & Validation Stricte** :
  - Créer systématiquement une classe `FormRequest` (`php artisan make:request`) pour chaque point d'entrée modifiant l'état (`POST`, `PUT`, `PATCH`).
  - Définir l'autorisation dans la méthode `authorize()` de la `FormRequest` ou via une `Policy` Laravel.
  - Bannir la validation directe `$request->validate([...])` dispersée dans les méthodes de contrôleurs.
- **Inversion de Contrôle & Service Container** :
  - Enregistrer les services et interfaces dans des `ServiceProvider` dédiés.
  - Injecter les dépendances via le constructeur pour permettre un remplacement aisé lors des tests unitaires.

---

## 2. Persistance & ORM Eloquent

- **Prévention Systématique du N+1** :
  - Utiliser le chargement précoce (*Eager Loading*) via `with(['relation1', 'relation2'])` lors de la récupération de collections d'entités.
  - Activer la détection automatique des requêtes non eager en environnement local dans `AppServiceProvider` :
    ```php
    Model::preventLazyLoading(! app()->isProduction());
    ```
- **Mass Assignment & Sécurité des Modèles** :
  - Définir explicitement `$fillable` sur les modèles Eloquent pour restreindre les attributs modifiables en masse.
  - Ne jamais utiliser `$guarded = []` sans filtrage strict préalable des entrées utilisateur.
- **Transactions de Données** :
  - Encapsuler toute suite d'opérations d'écriture interdépendante dans `DB::transaction(function () { ... });` pour garantir la cohérence atomique des données.

---

## 3. Middlewares, Événements & Tâches Asynchrones

- **Middlewares d'Intégrité & Sécurité** :
  - Appliquer les middlewares d'authentification (`auth:sanctum`), de limitation de débit (`throttle:api`) et de vérification d'accès (*Route Model Binding* avec Policies) directement au niveau des routes.
- **Jobs, Queues & Découplage Asynchrone** :
  - Déporter l'envoi de courriels, la génération de documents lourds et les appels d'APIs tierces dans des tâches en file d'attente implémentant `ShouldQueue`.
  - Configurer des tentatives de rejeu maîtrisées (`$tries = 3`) et une gestion des échecs via la méthode `failed()`.

---

## 4. Tests Automatisés avec Pest ou PHPUnit

- **Isolation de la Base de Données de Test** :
  - Utiliser le trait `RefreshDatabase` ou `LazilyRefreshDatabase` dans les suites de tests.
  - Utiliser les *Model Factories* pour générer des états de test réalistes sans dépendre de données statiques en base.
- **Tests d'API & Réponses HTTP** :
  - Écrire des tests de fonctionnalités (*Feature Tests*) vérifiant les codes HTTP, la structure JSON (`assertJsonStructure`) et les autorisations (test des cas 401 et 403).
