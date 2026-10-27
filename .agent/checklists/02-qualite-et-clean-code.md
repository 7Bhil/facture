# Checklist 02 : Qualité de Code, Clean Code & Bonnes Pratiques

*Sources d'inspiration : `references/clean-code-javascript`, `references/nodebestpractices`, `references/javascript`*

---

## 1. Nommage et Clarté Intentionnelle

- [ ] **Noms révélateurs d'intention** :
  - Variables : `activeUserAccounts` plutôt que `data`, `list` ou `users`.
  - Fonctions : verbe d'action explicite (`calculateOrderTotal()`, `findUserByEmail()`, `isSubscriptionActive()`).
- [ ] **Pas d'abréviations cryptiques** :
  - Éviter `acc`, `ctx`, `req2`, `tmp`, `fn` sauf dans des lambdas triviales de 1 ligne.
- [ ] **Constantes nommées vs Magic Numbers** :
  - Remplacer les valeurs brutes (`86400000`, `3`) par des constantes sémantiques (`const MS_PER_DAY = 24 * 60 * 60 * 1000; const MAX_LOGIN_ATTEMPTS = 3;`).

---

## 2. Conception des Fonctions & Principes SOLID

- [ ] **Single Responsibility Principle (SRP)** :
  - Une fonction ne fait qu'une seule chose et la fait bien.
  - Taille idéale : moins de 20 à 30 lignes. Si une fonction nécessite des commentaires pour séparer des blocs logiques, découper en sous-fonctions.
- [ ] **Nombre d'arguments limité** :
  - Maximum 2 à 3 arguments positionnels. Au-delà, passer par un objet de paramètres typé (destructuring).
- [ ] **Éviter les effets de bord inattendus (Pure Functions)** :
  - Ne pas muter directement les objets ou tableaux passés en paramètres (`structuredClone`, spread operator ou immutabilité).
  - Éviter de modifier un état global depuis une fonction utilitaire.

---

## 3. Gestion Robuste des Erreurs

- [ ] **Erreurs typées et hiérarchisées** :
  - Créer des classes d'erreurs applicatives (`NotFoundError`, `UnauthorizedError`, `ValidationError`) héritant de `Error`.
  - Toujours renseigner le message, le code d'erreur et la cause (`new Error("...", { cause: err })`).
- [ ] **Ne jamais avaler les erreurs en silence** :
  - Interdiction formelle du pattern `catch (e) {}` vide.
  - Soit l'erreur est réparable avec un fallback maîtrisé, soit elle est journalisée avec son contexte et propagée.
- [ ] **Async / Await sans fuite d'Unhandled Rejections** :
  - Utiliser systématiquement `try / catch` ou des intercepteurs middleware globaux.
  - S'assurer que les promesses rejetées n'entraînent pas de crash inattendu du process Node.js.
