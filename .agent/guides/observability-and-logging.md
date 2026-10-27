# Règles Senior : Observabilité, Télémétrie & Logs Structurés

> **Standards de référence** : OpenTelemetry (OTel), Twelve-Factor App (Logs as Event Streams), Google SRE Golden Signals, RFC 5424 (Syslog).

---

## 1. Format des Logs : Structuration JSON Obligatoire

- **Bannissement des Chaînes de Texte Brutes (`console.log`)** :
  - En production, tout log doit être émis sous forme d'un objet JSON sur une seule ligne (*newline-delimited JSON*) vers la sortie standard (`stdout`).
  - Utiliser un logger performant (Pino pour Node.js, Structlog pour Python, Logback/SLF4J pour Java).
- **Champs Standards Minimaux par Entrée de Log** :
  - `timestamp` : Format ISO 8601 strict en temps universel UTC (`2026-09-26T22:15:00.000Z`).
  - `level` : Niveau de sévérité sémantique (`debug`, `info`, `warn`, `error`, `fatal`).
  - `trace_id` / `correlation_id` : Identifiant unique de corrélation distribuée transmis via l'en-tête `X-Correlation-ID` ou les standards W3C Trace Context (`traceparent`).
  - `service` : Nom canonique du service émetteur.
  - `message` : Phrase descriptive claire et concise sans interpolation de données sensibles.
  - `context` : Objet structuré contenant les métadonnées techniques utiles (identifiant de tenant, méthode HTTP, durée en ms, code de statut).

---

## 2. Niveaux de Log & Discipline de Sévérité

- **`debug`** : Détails verbeux réservés au diagnostic en environnement de développement ou de staging. Ne doit jamais être actif en production sous charge nominale.
- **`info`** : Événements métier significatifs du cycle de vie (démarrage du serveur, traitement d'une commande, création d'un compte).
- **`warn`** : Situation anormale mais récupérable n'empêchant pas la requête d'aboutir (rejeu après timeout réseau, cache indisponible avec repli sur la base).
- **`error`** : Défaillance bloquante pour la requête courante nécessitant une investigation (exception non gérée, erreur SQL fatale). Toujours associer la stack trace typée et le contexte d'erreur.
- **`fatal`** : Défaillance critique entraînant l'arrêt imminent du processus (échec d'initialisation de la base au démarrage).

---

## 3. Les 4 Signaux d'Or (Google SRE Golden Signals)

Toute application critique doit exposer des métriques permettant de mesurer en continu :

1. **Latence** : Temps nécessaire pour traiter une requête (distribuer en percentiles p50, p95, p99 plutôt qu'en simple moyenne arithmétique trompeuse).
2. **Trafic** : Volume de charge imposé au système (requêtes HTTP par seconde, messages Kafka traités par minute).
3. **Erreurs** : Taux de requêtes en échec (taux de codes HTTP 5xx, exceptions non rattrapées).
4. **Saturation** : Niveau de consommation des ressources système (utilisation mémoire tas/heap, saturation du pool de connexions HikariCP/Prisma, Event Loop lag).

---

## 4. Sondes de Santé Découplées (*Health Probes*)

Pour permettre aux orchestrateurs (Kubernetes, Docker Swarm, AWS ECS) de gérer le cycle de vie des conteneurs sans interruption de service :

- **Sonde de Vie (`GET /health/live` ou Liveness)** :
  - Vérifie uniquement si le processus applicatif répond.
  - Ne doit pas interroger les dépendances externes (base de données, Redis). Si le thread principal tourne, renvoyer HTTP 200. Si cette sonde échoue, l'orchestrateur redémarre le conteneur.
- **Sonde d'Aptitude (`GET /health/ready` ou Readiness)** :
  - Vérifie si le conteneur est prêt à accepter du trafic utilisateur réel.
  - Teste brièvement la connexion à la base de données (`SELECT 1`) et la disponibilité des caches critiques avec un timeout court (< 2 secondes).
  - Si cette sonde échoue, l'orchestrateur retire temporairement le conteneur du répartiteur de charge sans le détruire.
- **Sonde de Démarrage (`GET /health/startup` ou Startup)** :
  - Réservée aux applications avec temps d'amorçage long (chargement de gros modèles, migrations initiales) pour différer le contrôle de liveness.
