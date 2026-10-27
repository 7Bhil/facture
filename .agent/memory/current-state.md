# État Courant de Session & Tâches Actives

État présent uniquement (40 lignes maximum). L'historique est dans `git log`.

---

## 1. Tâche Actuelle
- **Objectif** : Application de normalisation e-MECeF pour AGL et SOCOPAO.
- **Branche Active** : `feature/normalisation-mecef`.

## 2. Actions Complétées
- [x] Alignement strict sur les règles du profil 7Bhil : suppression des émojis dans le code et les commits, gestion de branche `feature/normalisation-mecef` issue de `developp`.
- [x] Implémentation du backend Express JS (`server.js`) avec persistance SQLite et gestion de l'idempotence.
- [x] Configuration du client React avec Tailwind CSS v3 et PostCSS (`postcss.config.js`).
- [x] Rendu conforme du ticket DGI (SyGMEF) avec QR Code SVG et feuille de style dédiée à l'impression PDF.

## 3. Prochaine Étape
- Validation fonctionnelle par l'utilisateur et tests de saisie d'un lot de factures.
