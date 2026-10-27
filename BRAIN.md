# Index Opérationnel du Projet : Facturation & Normalisation e-MECeF

## 1. Contexte & Mission
Application dédiée à la normalisation fiscale des factures AGL Bénin et SOCOPAO via l'API e-MECeF (SyGMEF / DGI Bénin).

## 2. Règles Métier Clés
- **Multi-Entités** : AGL et SOCOPAO (profils fiscaux étanches, tokens distincts).
- **Ventilation Fiscale** : Séparation stricte entre prestations taxables (TVA 18% - Groupe B) et Débours (sans TVA - Groupe A).
- **Idempotence & Contrôle Anti-Doublon** : Blocage automatique des factures déjà normalisées, confirmation explicite utilisateur sur doublon potentiel.
- **Rendu Facture** : Reproduction conforme du ticket officiel DGI (SyGMEF) et téléchargement PDF immédiat.

## 3. Architecture Technique
- **Backend / Serveur Local** : Python (FastAPI / Standard HTTP), persistance SQLite locale (`factures.db`).
- **Frontend** : Interface Web locale légère (saisie rapide, vérification en direct, aperçu du ticket officiel, impression/téléchargement).
- **Spécifications DGI** : OpenAPI V1 (`v1_swagger.json`).
