# Checklist 03 : Sécurité Applicative & Sécurité d'API

*Sources d'inspiration : `references/Top10`, `references/API-Security`, `references/ASVS`, `references/CheatSheetSeries`*

---

## 1. Contrôle d'Accès & Autorisations (BOLA / BFLA)

- [ ] **Vérification d'appartenance de la ressource (Anti-BOLA / IDOR)** :
  - Ne jamais faire confiance à un ID fourni en URL ou payload (`/api/documents/:id`).
  - Toujours valider : `WHERE document.id = :id AND document.org_id = currentUser.org_id` ou via policy d'autorisation.
- [ ] **Principe du Moindre Privilège** :
  - Chaque rôle d'utilisateur ne dispose strictement que des permissions nécessaires à ses actions.
  - La vérification d'autorisation doit être exécutée au niveau du service métier, pas seulement sur le routage.

---

## 2. Validation & Assainissement des Entrées (Anti-Injection & XSS)

- [ ] **Schéma de validation strict (Fail Closed)** :
  - Validation exhaustive des corps de requêtes, paramètres de query et headers via un schéma strict (ex: Zod, Valibot).
  - Rejet automatique des champs inattendus (`strip` ou `strict`).
- [ ] **Requêtes SQL / NoSQL paramétrées** :
  - Aucune concaténation de chaînes dans les requêtes (`db.query('SELECT ... ' + id)` est proscrit).
  - Utilisation systématique de requêtes préparées ou d'ORM sécurisés.
- [ ] **Échappement et assainissement des sorties (Anti-XSS)** :
  - Ne jamais injecter de HTML brut sans désinfection préalable (ex: DOMPurify).
  - Configuration d'en-têtes HTTP de sécurité via Helmet : `Content-Security-Policy`, `X-Content-Type-Options: nosniff`.

---

## 3. Authentification & Gestion des Secrets

- [ ] **Stockage des mots de passe et hashage** :
  - Algorithmes modernes et lents : Argon2id ou Bcrypt (avec cost factor adapté).
- [ ] **Gestion des Secrets** :
  - Zéro secret ou token codé en dur dans le dépôt.
  - Chargement strict via variables d'environnement validées au démarrage (ex: `process.env` typé).
- [ ] **Sessions & Tokens JWT** :
  - Tokens d'accès à courte durée de vie.
  - Cookies de session configurés avec les flags `HttpOnly`, `Secure`, `SameSite=Strict` ou `Lax`.
- [ ] **Protection contre les attaques par force brute** :
  - Rate limiting sur les endpoints d'authentification (`/login`, `/register`, `/reset-password`).
