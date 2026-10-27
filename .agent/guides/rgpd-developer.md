# Guide RGPD & Protection des Données Personnelles pour Développeurs

> **Sources de référence condensées** : `Guide-RGPD-du-developpeur`, `references/Guide-RGPD-du-developpeur`.

Ce guide condense les obligations légales et techniques issues du RGPD (Règlement Général sur la Protection des Données) applicables dès la conception du code (*Privacy by Design*).

---

## 1. Principes Fondamentaux de Conception

### 1.1 Minimisation des Données (Art. 5.1.c)
Ne collecter **que** les données strictement indispensables à la finalité du service :
- Pas de collecte "au cas où".
- Si un service a seulement besoin de vérifier que l'utilisateur est majeur, ne pas stocker sa date de naissance complète mais un booléen `isAdult: boolean`.

### 1.2 Données Sensibles (Art. 9)
Interdiction absolue de traiter sans consentement explicite et mesures de chiffrement renforcées : origines raciales ou ethniques, opinions politiques, croyances religieuses, données génétiques, biométriques, données de santé ou vie sexuelle.

---

## 2. Journalisation & Nettoyage des Logs Applicatifs

Ne **jamais** inscrire de Données à Caractère Personnel (PII) en clair dans les logs serveurs ou fichiers d'erreurs.

```typescript
//  VRAI : Configuration d'un logger (Pino / Winston) avec masquage automatique
import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.newPassword',
      'req.body.creditCard',
      'req.body.email',
      'user.email',
      'user.phoneNumber',
    ],
    censor: '[CONFIDENTIEL - RGPD]',
  },
});
```

---

## 3. Gestion du Cycle de Vie & Droits des Personnes

### 3.1 Droit à l'Oubli / Suppression (Art. 17)
Lorsqu'un utilisateur demande la suppression de son compte :
1. Supprimer immédiatement ses données identifiantes.
2. Pour les tables d'audit ou de facturation devant être légalement conservées (comptabilité), **anonymiser** les références :
```sql
-- Anonymisation irréversible des commandes archivées
UPDATE orders 
SET customer_name = 'UTILISATEUR_SUPPRIME',
    shipping_address = 'SUPPRIME',
    billing_email = NULL 
WHERE user_id = :userId;
```

### 3.2 Purge Automatisée des Comptes Inactifs
Implémenter un worker ou cron job planifié supprimant ou anonymisant les comptes inactifs selon la durée déclarée (ex: inactivité > 2 ans ou 3 ans).
