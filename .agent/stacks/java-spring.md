# Règles Senior : Java & Spring Boot

> **Standards de référence** : Java 17 / 21 LTS, Spring Boot 3.x, Spring Security 6, Jakarta EE, Effective Java (Joshua Bloch).

---

## 1. Architecture Applicative & Inversion de Contrôle (IoC)

- **Injection de Dépendances par Constructeur** :
  - Injecter systématiquement les dépendances via le constructeur de la classe avec des champs `private final`.
  - Bannir l'injection par champ `@Autowired private MonService monService;` (rend les tests unitaires opaques et empêche l'immutabilité).
- **Découpage en Couches Strictes** :
  - **Controller / REST Resource** : Valide les requêtes entrantes (`@Valid`, DTOs Jakarta Validation) et retourne des `ResponseEntity<T>`. Aucun accès direct à la base de données.
  - **Service** : Logique métier encapsulée, transactions gérées par `@Transactional(readOnly = true)` par défaut au niveau classe, et `@Transactional` sur les méthodes d'écriture.
  - **Repository** : Interfaces `JpaRepository` ou `CrudRepository`. Ne contient aucune logique métier.
- **DTOs Immutables avec Java Records** :
  - Utiliser les `record` Java pour tous les objets de transfert de données (DTOs requêtes/réponses).
  - Éviter d'exposer directement les entités JPA dans les endpoints REST pour prévenir le sur-chargement de données (*over-fetching*) et les boucles de sérialisation JSON.

---

## 2. Persistance & JPA / Hibernate

- **Gestion des Relations & Chargement Fainéant (Lazy Loading)** :
  - Configurer `FetchType.LAZY` sur toutes les associations (`@ManyToOne`, `@OneToOne`, `@OneToMany`, `@ManyToMany`). Les relations eager par défaut causent des requêtes inutiles.
  - Prévenir le problème critique des requêtes `N+1` : utiliser `@EntityGraph`, des jointures explicites `JOIN FETCH` dans les requêtes JPQL ou des projections d'interfaces.
- **Transactions & Isolation** :
  - Préciser le niveau d'isolation si requis. Isoler les opérations d'écriture en base dans des frontières transactionnelles courtes.
  - Ne jamais exécuter d'appels réseau externes lents (appels API tiers) à l'intérieur d'un bloc transactionnel `@Transactional` pour éviter d'épuiser le pool de connexions HikariCP.

---

## 3. Idiomes Java Modernes & Clean Code

- **Programmation Fonctionnelle & Streams** :
  - Utiliser l'API `Stream` et `Optional` de manière idiomatique sans chaînages illisibles ou effets de bord à l'intérieur d'un `map` ou `forEach`.
  - Ne jamais utiliser `Optional.get()` sans vérification préalable ; privilégier `orElseThrow()`, `orElseGet()` ou `map()`.
  - Ne jamais passer un `Optional` en paramètre de méthode ni l'utiliser comme champ d'entité JPA.
- **Gestion Globale des Exceptions** :
  - Centraliser le traitement des erreurs via `@RestControllerAdvice` et `@ExceptionHandler`.
  - Renvoyer des réponses d'erreur standardisées au format RFC 7807 (*Problem Details for HTTP APIs*) via `ProblemDetail`.

---

## 4. Stratégie de Test avec JUnit 5 & Testcontainers

- **Tests Unitaires Ciblés** :
  - Utiliser JUnit 5 (`@Test`, `@ParameterizedTest`) et Mockito (`@ExtendWith(MockitoExtension.class)`).
  - Éviter d'instancier le contexte Spring complet (`@SpringBootTest`) pour des tests de logique métier pure.
- **Tests d'Intégration Réalistes** :
  - Utiliser `@DataJpaTest` ou `@WebMvcTest` pour les tests de tranches (*slice testing*).
  - Employer `Testcontainers` avec de véritables conteneurs Docker (PostgreSQL, Redis, Kafka) plutôt que des bases en mémoire de type H2 afin de garantir la parité avec l'environnement de production.
