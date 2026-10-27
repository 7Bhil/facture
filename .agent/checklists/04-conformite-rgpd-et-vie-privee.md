# Checklist 04 : Conformité RGPD & Protection de la Vie Privée

*Sources d'inspiration : `Guide-RGPD-du-developpeur`, `references/Guide-RGPD-du-developpeur`*

---

## 1. Privacy by Design & Minimisation des Données

- [ ] **Minimisation stricte de la collecte (Art. 5 RGPD)** :
  - Chaque champ demandé à l'utilisateur doit répondre à une finalité explicite et légitime.
  - Pas de collecte de données "au cas où" (ex: date de naissance ou numéro de téléphone inutiles).
- [ ] **Données sensibles interdites sans cadre spécifique (Art. 9 RGPD)** :
  - Pas de traitement de données de santé, opinions politiques, croyances, données biométriques sans base légale explicite et mesures de chiffrement renforcées.

---

## 2. Journalisation & Fuites de Données Personnelles (PII)

- [ ] **Nettoyage des Logs applicatifs** :
  - Masquage / anonymisation systématique des adresses IP, adresses emails, noms, coordonnées bancaires et tokens dans les logs (`winston`, `pino` avec masquage automatique).
  - Ne jamais logguer le corps brut de requêtes contenant des formulaires d'inscription ou d'authentification.
- [ ] **Chiffrement au repos et en transit** :
  - TLS 1.3 / HTTPS obligatoire pour tout échange réseau.
  - Chiffrement au niveau applicatif ou colonne pour les données hautement confidentielles.

---

## 3. Cycle de Vie, Conservation & Droits des Personnes

- [ ] **Durée de conservation limitée (Purge automatisée)** :
  - Mécanisme de purge ou d'anonymisation programmé (cron/worker) pour les comptes inactifs ou données obsolètes.
- [ ] **Respect des droits (Accès, Rectification, Suppression / Droit à l'oubli)** :
  - Prévoir une procédure d'export structuré des données de l'utilisateur (format JSON/CSV).
  - La suppression de compte doit effacer ou anonymiser irréversiblement les données personnelles rattachées (gestion des clés étrangères : anonymiser les tables d'audit sans laisser de lien vers l'individu).
