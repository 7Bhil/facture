# Règles Senior : Python, FastAPI & Django

> **Standards de référence** : PEP 8, mypy strict, Pydantic V2, FastAPI, Django 4.x / 5.x, ASGI/WSGI.

---

## 1. Typage & Validation Stricte

- **Type Annotations obligatoires** :
  - Configurer `mypy` en mode strict (`disallow_untyped_defs = true`, `check_untyped_defs = true`).
  - Bannir le type `Any` et les annotations incomplètes dans les signatures de fonctions, classes et endpoints publics.
- **Modélisation & Contrats Pydantic V2** :
  - Définir des schémas explicites d'entrée (*Request Payload*) et de sortie (*Response Model*).
  - Activer la protection contre l'assignation de masse : `model_config = ConfigDict(extra='forbid')`.
  - Employer `Annotated` avec des validateurs de champ (`Field(gt=0, max_length=100)`) pour garantir la validation déclarative des frontières applicatives.

---

## 2. Spécificités FastAPI : Injection de Dépendances & Asynchronisme

- **Système d'Injection de Dépendances (`Depends`)** :
  - Découpler l'accès aux ressources partagées (sessions de base de données SQLAlchemy/SQLModel, client Redis, extraction de l'utilisateur authentifié) via des générateurs injectés avec `Depends`.
  - Isoler la gestion des transactions via un générateur asynchrone avec bloc `try / finally` garantissant la fermeture de session :
    ```python
    async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with async_session_factory() as session:
            try:
                yield session
            finally:
                await session.close()
    ```
- **Règle Fondamentale de Concurrence ASGI (Async vs Sync)** :
  - Déclarer `async def` **uniquement** si le corps de la fonction exécute des opérations d'E/S non-bloquantes avec `await`.
  - Déclarer `def` standard pour toute fonction exécutant du code bloquant ou CPU-intensif, afin que FastAPI délègue son exécution au thread pool séparé et ne bloque pas l'Event Loop principal.

---

## 3. Spécificités Django : Middlewares & ORM Efficace

- **Chaîne de Middlewares sur Mesure** :
  - Respecter le protocole standard des middlewares Django (`__call__(self, request)`).
  - Placer les middlewares d'audit, de corrélation (`X-Request-ID`) ou de limitation de débit au bon niveau de la pile, en tenant compte de l'ordre d'évaluation (amont vs aval de l'authentification).
  - Éviter d'exécuter des requêtes en base de données coûteuses dans les middlewares s'exécutant sur chaque requête HTTP.
- **Optimisation de l'ORM & Prévention du N+1** :
  - Utiliser systématiquement `select_related()` pour les relations à cardinalité unique (`ForeignKey`, `OneToOneField`) via une jointure SQL directe.
  - Utiliser `prefetch_related()` pour les relations multiples (`ManyToManyField`, clés étrangères inverses) afin de charger les entités associées en un nombre constant de requêtes.
  - Définir des `QuerySets` personnalisés encapsulant la logique de filtrage réutilisable et restreindre les champs retournés avec `only()` ou `defer()` sur les tables volumineuses.
