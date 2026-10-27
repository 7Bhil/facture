# Contraintes Techniques & Architecturales Actives

Ce fichier consigne les contraintes strictes, engagements réglementaires et choix d'architecture incompressibles s'appliquant au projet.

---

## 1. Contraintes Architecturales
- **Pureté du Core** : Les règles universelles d'ingénierie (`core/RULES.md`) ne doivent jamais dépendre d'une préférence subjective ou d'une personne en particulier.
- **Zéro Dépendance Lourde** : Tous les scripts utilitaires doivent fonctionner avec la bibliothèque standard Python 3 ou Bash standard (zéro `npm install` obligatoire pour installer le kit).
- **Parité des Fichiers Miroirs** : Les fichiers d'adaptation pour les agents doivent être dérivés de manière déterministe depuis le Core.

---

## 2. Contraintes de Sécurité
- **Secrets** : Aucun secret, token ou clé API commité dans Git. Blocage pré-commit via Gitleaks si installé.
- **Analyse Statique** : Conformité aux règles Semgrep définies dans `.semgrep.yml`.
- **Dépendances** : Audit `npm audit --audit-level=high` bloquant sur tout projet Node.js consommateur.

---

## 3. Contraintes de Qualité et Mémoire
- **ADR Obligatoires** : Tout arbitrage architectural de fond (nouveau framework, refonte de stockage, protocole de sécurité) doit donner lieu à un ADR numéroté dans `docs/decisions/`.
- **Cycle de Vie des Tests** : Tout nouveau code doit être accompagné de ses tests. Tout code retiré doit voir ses tests dépréciés supprimés.
