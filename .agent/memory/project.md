# Contexte Technique du Projet

Ce fichier documente la nature, les briques technologiques et l'environnement du projet courant. Il est mis à jour lors de l'onboarding initial (Phase 0) et lors de tout changement structurant de dépendance.

---

## 1. Identité du Projet
- **Nom du Projet** : Senior Agent Core (`7Bhil/agent`)
- **Description** : Système d'exploitation d'ingénierie logicielle pour agents IA (règles universelles, mémoire structurée, adapters multi-agents, harnais d'évaluations déterministes).
- **Type d'Application** : Toolkit d'outillage & système de cadrage multi-assistants.

---

## 2. Environnement & Runtimes
- **Langages Utilisés** : Bash, Python 3 (stdlib sans dépendance externe), Markdown, YAML.
- **Gestionnaire de Paquets** : N/A (zéro dépendance npm/pip externe imposée au kit).
- **Intégration Continue** : GitHub Actions (`.github/workflows/ci.yml`), GitLab CI (`templates/.gitlab-ci.yml`).

---

## 3. Dépendances & Outils Externes Recommandés
- **Audit de Sécurité Statique** : Semgrep (`.semgrep.yml`), Gitleaks (secrets).
- **Audit Textuel Déterministe** : `scripts/audit-slop.py`.
- **Harnais de Validation** : `scripts/test-kit.sh`.
