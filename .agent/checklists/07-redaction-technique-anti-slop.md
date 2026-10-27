# Checklist 07 : Rédaction Technique, Clarté & Anti-Slop IA

*Sources d'inspiration : `guides/clean-technical-writing.md`, `scripts/audit-slop.py`*

---

## 1. Concision et Affirmation Directe (Anti-Hedging)

- [ ] **Suppression des précautions oratoires inutiles** :
  - Pas de `il convient de noter`, `il est important de souligner`, `force est de constater`.
  - Les faits techniques sont affirmés directement à la voix active.
- [ ] **Élimination des quantificateurs flous** :
  - Remplacer `une pléthore de`, `une multitude de`, `un large éventail` par la liste exacte ou le nombre précis.
- [ ] **Suppression des transitions d'en-tête mécaniques** :
  - Éviter d'ouvrir chaque paragraphe par `De plus,`, `En outre,`, `Par ailleurs,`.
  - Lier les idées par la structure logique du paragraphe plutôt que par des connecteurs artificiels.

---

## 2. Sobriété et Élimination de l'Emphase

- [ ] **Zéro dramatisation d'époque** :
  - Aucun `dans le monde d'aujourd'hui`, `à l'ère du numérique`, `plus que jamais`.
- [ ] **Zéro fausse connivence** :
  - Aucun `soyons honnêtes`, `voilà le problème`, `vérité soit dite`.
- [ ] **Zéro métaphore grandiloquente** :
  - Pas de `plonger au cœur de`, `véritable témoignage de`, `naviguer dans les méandres de`.
- [ ] **Zéro clôture résumative redondante** :
  - Pas de paragraphe d'enrobage final débutant par `En conclusion` ou `En somme`. Terminer dès que l'information technique est transmise.

---

## 3. Respect Factuel et Anti-Invention

- [ ] **Zéro spéculation sur les signatures ou API** :
  - Si une méthode, une option ou un identifiant n'est pas vérifié, inspecter le code source avant de documenter.
  - Ne jamais combler un trou par un exemple plausible mais fictif sans le tester.
- [ ] **Marqueurs explicites pour les données manquantes** :
  - Utiliser un libellé clair type `[token_secret_ici]` ou `[port_d_ecoute]` plutôt que d'inventer des valeurs sensibles réalistes.

---

## 4. Vérification Automatisée

- [ ] **Audit scripté exécuté avec succès** :
  ```bash
  python3 scripts/audit-slop.py <fichiers_modifies>
  ```
  Le résultat de la commande doit retourner un code de sortie 0 (zéro tic détecté).
