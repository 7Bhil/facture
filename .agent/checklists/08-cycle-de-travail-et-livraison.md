# Checklist d'Exécution & Cycle de Travail Senior (WORKFLOW.md)

Cette grille guide l'agent et le développeur à travers les 8 étapes rigoureuses d'un cycle de livraison.
Pour chaque point, l'agent doit évaluer explicitement l'état : **DONE**, **FAILED**, **NOT APPLICABLE** (N/A) ou **BLOCKED**.

---

## 1. Découverte & Exploration (Discovery - Phase 0)
- [ ] **Baseline Tests** : Suite de tests existante exécutée avant toute modification (`DONE` / `BLOCKED`).
- [ ] **Conventions Locales** : Inspection des descripteurs (`package.json`, `Cargo.toml`, etc.) et du style de code existant (`DONE`).
- [ ] **Archéologie Git** : `git log` et `git blame` consultés sur les zones patrimoniales modifiées (`DONE` / `N/A`).
- [ ] **Tests de Caractérisation** : Rédigés au préalable en cas de refactoring sur du code non couvert (`DONE` / `N/A`).

---

## 2. Cadrage & Planification (Planning)
- [ ] **Diagnostic de Cause Racine** : Mécanisme précis défaillant identifié sans se limiter au symptôme (`DONE`).
- [ ] **Périmètre d'Impact** : Liste des modules, routes et contrats affectés établie (`DONE`).
- [ ] **Évaluation ADR** : Arbitrage architectural durable formalisé si nécessaire dans `docs/decisions/` (`DONE` / `N/A`).

---

## 3. Implémentation & Clean Code (Implementation)
- [ ] **Typage Strict** : Zéro type évasif (`any`), typage explicite des entrées et retours (`DONE`).
- [ ] **Validation aux Frontières** : Schémas Zod/Valibot sur les données externes entrantes (`DONE` / `N/A`).
- [ ] **Refus de la Dette** : Zéro code mort, zéro bloc commenté, zéro hack sans issue (`DONE`).
- [ ] **Design System** : Utilisation exclusive des tokens et variables sémantiques de `DESIGN-SYSTEM.md` (`DONE` / `N/A`).

---

## 4. Stratégie de Tests (Testing)
- [ ] **Nominal & Limites** : Cas nominal couvert avec au minimum 2 cas limites (null, vide, accès refusé) (`DONE`).
- [ ] **Reproduction Préalable** : En cas de bug (`fix`), test reproduisant le bug au rouge avant correctif (`DONE` / `N/A`).
- [ ] **Nettoyage Actif** : Suppression propre des tests associés aux fonctionnalités dépréciées (`DONE` / `N/A`).

---

## 5. Sécurité & Données (Security)
- [ ] **Contrôle BOLA / IDOR** : Vérification de l'ownership au niveau service/métier (`DONE` / `N/A`).
- [ ] **Protection Injections** : Requêtes SQL préparées, zéro concaténation de chaînes (`DONE` / `N/A`).
- [ ] **Secrets & Logs** : Zéro clé, token ou mot de passe dans le code ou les sorties de journalisation (`DONE`).

---

## 6. Revue & Contrôles Déterministes (Review)
- [ ] **Audit Anti-Slop** : `python3 scripts/audit-slop.py` validé sans aucun tic de langage (`DONE`).
- [ ] **Harnais de Test** : `scripts/test-kit.sh` et `scripts/run-evals.py` exécutés avec succès (`DONE`).
- [ ] **Analyse Statique** : Conformité aux règles Semgrep `.semgrep.yml` (`DONE` / `N/A`).

---

## 7. Documentation & Mémoire (Documentation)
- [ ] **Mémoire Structurée** : Mise à jour de `.agent/memory/current-state.md` (`DONE`).
- [ ] **Index Opérationnel** : `BRAIN.md` vérifié et pointant vers les modules appropriés (`DONE`).
- [ ] **Code Self-Documented** : Nommage métier explicite sans commentaires redondants (`DONE`).

---

## 8. Livraison & Intégration (Delivery)
- [ ] **Conventions de Commit** : Messages rédigés selon la convention de `.agent/config.yml` (`DONE`).
- [ ] **Stratégie de Branche** : Branche thématique testée puis fusionnée sur la branche d'intégration (`DONE`).
