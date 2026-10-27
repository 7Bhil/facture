# Règles Senior : Gestion & Architecture des Bases de Données (SQL / NoSQL)

> **Standards de référence** : Principes ACID, Théorème CAP, Normalisation relationnelle, Modélisation NoSQL, OWASP Injection Prevention.

---

## 1. Modélisation Relationnelle (SQL : PostgreSQL, MySQL)

- **Normalisation & Dénormalisation Délibérée** :
  - Concevoir initialement les schémas selon la Troisième Forme Normale (3NF) pour éliminer les anomalies d'insertion, de mise à jour et de suppression.
  - La dénormalisation (champs calculés, tables de résumé) n'est autorisée qu'après profilage mesuré d'un goulot d'étranglement en lecture.
- **Stratégie d'Indexation Réflechie** :
  - Créer des index sur les colonnes utilisées dans les jointures (`FOREIGN KEY`), les filtres fréquents (`WHERE`), les tris (`ORDER BY`) et les regroupements (`GROUP BY`).
  - Index composites : respecter la règle du préfixe le plus à gauche (*Leftmost Prefix Rule*). Placer la colonne d'égalité stricte en première position et les filtres d'intervalle en fin d'index.
  - Éviter la prolifération d'index inutilisés : chaque index dégrade les performances des opérations d'écriture (`INSERT`, `UPDATE`, `DELETE`) et consomme de la mémoire vive.
  - Utiliser `EXPLAIN ANALYZE` (ou équivalent moteur) pour valider qu'une requête exploite un balayage d'index (*Index Scan*) plutôt qu'un balayage complet de table (*Sequential Scan*).
- **Contraintes d'Intégrité au Niveau Moteur** :
  - Définir les clés primaires, contraintes d'unicité (`UNIQUE`), clés étrangères (`FOREIGN KEY` avec `ON DELETE RESTRICT` ou `CASCADE` explicite) et vérifications (`CHECK`).
  - Ne jamais déléguer l'intégrité référentielle uniquement à la couche applicative.

---

## 2. Transactions & Propriétés ACID

- **Atomicity, Consistency, Isolation, Durability** :
  - Regrouper toute séquence de modifications dépendantes dans une transaction explicite (`BEGIN` ... `COMMIT` / `ROLLBACK`).
  - Définir le niveau d'isolation adéquat : `READ COMMITTED` par défaut pour la majorité des charges, `REPEATABLE READ` ou `SERIALIZABLE` pour les opérations financières critiques.
  - Garder les transactions aussi courtes que possible pour minimiser la contention et le risque d'interblocage (*Deadlock*).
- **Gestion des Concurrences** :
  - Privilégier le verrouillage optimiste (*Optimistic Locking* via une colonne de version `version_id`) pour les architectures à forte concurrence en lecture.
  - Utiliser le verrouillage pessimiste (`SELECT ... FOR UPDATE`) avec discernement et toujours avec un timeout configuré pour éviter de bloquer des threads indéfiniment.

---

## 3. Modélisation NoSQL & Systèmes Clé-Valeur / Documents

- **Modélisation Guidée par les Requêtes (Query-First Modeling)** :
  - Contrairement au relationnel, modéliser les documents (MongoDB) ou partitions (DynamoDB, Cassandra) en fonction des patterns d'accès exacts de l'application.
  - **Intégration (*Embedding*) vs Référencement** :
    - Intégrer les sous-documents si la cardinalité est 1:1 ou 1:N restreint et que les données sont lues conjointement.
    - Référencer si les données grandissent sans limite (cardinalité infinie) ou si elles sont accédées séparément.
- **Gestion du Cache & Clés d'Idempotence (Redis)** :
  - Définir systématiquement une durée de vie (`TTL`) sur toute clé de cache pour éviter l'épuisement mémoire.
  - Utiliser des clés de verrouillage distribué avec expiration automatique (pattern Redlock ou script Lua atomique).

---

## 4. Migrations & Évolution de Schéma sans Interruption (Zero Downtime)

- **Pattern Déploiement en Deux Phases (Expand and Contract)** :
  - Pour renommer ou restructurer une colonne en production :
    1. **Phase Expand** : Ajouter la nouvelle colonne, écrire dans l'ancienne et la nouvelle simultanément via l'application.
    2. **Phase Backfill** : Migrer les données historiques en arrière-plan par petits lots.
    3. **Phase Switch** : Basculer les lectures sur la nouvelle colonne.
    4. **Phase Contract** : Supprimer l'ancienne colonne après validation.
  - Ne jamais exécuter de migrations DDL lourdes et bloquantes (`ALTER TABLE ... ADD COLUMN ... DEFAULT ...` sans support instantané du moteur) sur des tables de production actives sans analyser les verrous de table associés.
