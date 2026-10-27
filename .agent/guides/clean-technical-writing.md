# Guide de Rédaction Technique : Sobriété, Clarté & Anti-Slop IA

Ce guide définit les règles rédactionnelles applicables à l'ensemble des livrables textuels du projet (documentations, `README.md`, spécifications, messages de commit, descriptions de Pull Requests et issues). Il formalise les principes d'éradication du remplissage artificiel généré par les modèles de langage (*AI-slop*).

---

## 1. Principes Fondamentaux de la Prose Technique

L'objectif de la documentation technique d'entreprise est de transmettre une information précise, vérifiable et immédiatement actionnable, sans artifice ni dilution.

1. **Suppression du *Hedging* (Affaiblissement oratoire)** :
   - Éliminer les formules de politesse ou de précaution qui diluent l'affirmation technique.
   - Si une propriété est vraie, l'énoncer directement à la voix active. Si elle est incertaine, spécifier la condition mesurable plutôt que d'ajouter un adverbe flou.
2. **Zéro Emphase Manufacturée** :
   - Bannir les déclarations grandiloquentes situant le projet dans une « époque critique » (`dans le monde d'aujourd'hui`, `à l'ère du numérique`, `un tournant décisif`).
   - Décrire les faits techniques, l'architecture et les métriques sans dramatisation.
3. **Zéro Connivence Artificielle (*Performed Candor*)** :
   - Supprimer les amorces cherchant à simuler la franchise (`soyons honnêtes`, `voilà le truc`, `truth be told`).
   - Aller directement au problème technique sans introduction conversationnelle.
4. **Zéro Enrobage Conversationnel (*Chatbot Wrappers*)** :
   - Éliminer les formules d'introduction ou de conclusion creuses (`Excellente question`, `J'espère que cela vous aide`, `En conclusion`, `En somme`).
5. **Anti-Hallucination et Respect Factuel** :
   - Ne jamais combler une inconnue par une conjecture plausible. Si une valeur ou une méthode est manquante, laisser un marqueur explicite `[valeur à renseigner]` ou inspecter la source.

---

## 2. Tableau Comparatif des Formulations (Avant / Après)

| Famille de Tic IA | Formulation Artificielle (À proscrire) | Formulation Technique Factuelle (À privilégier) |
|---|---|---|
| **Hedging / Précaution creuse** | `Il convient de noter que dans la plupart des cas, la mise en cache peut souvent améliorer les performances.` | *La mise en cache réduit la latence des requêtes fréquentes.* |
| **Enjeux manufacturés** | `Dans un monde numérique en constante évolution, sécuriser ses clés API est plus important que jamais.` | *Les clés API doivent être isolées dans un gestionnaire de secrets pour éviter les fuites.* |
| **Candeur jouée** | `Soyons honnêtes : personne n'aime maintenir du code sans tests automatisés.` | *L'absence de tests automatisés augmente le risque de régression lors du refactoring.* |
| **Quantificateurs vagues** | `La bibliothèque prend en charge une pléthore d'algorithmes de hachage.` | *La bibliothèque implémente Argon2id, bcrypt et PBKDF2.* |
| **Faux contrastes négatifs** | `Ce n'est pas seulement un ORM, c'est une toute nouvelle façon de concevoir la persistance.` | *Cet ORM gère la persistance et la validation des schémas.* |
| **Transitions redondantes** | `De plus, le serveur redémarre automatiquement en cas de crash.` | *Le processus redémarre sous supervision en cas d'erreur fatale.* |
| **Clôture stéréotypée** | `En conclusion, adopter cette architecture garantira le succès de vos projets futurs.` | *(Supprimer la conclusion : la section précédente suffit).* |

---

## 3. Deux Modes Rédactionnels pour les Assistants

Lorsqu'un agent rédige ou révise un texte technique, il doit appliquer l'un de ces deux modes :

### Mode Préservation (Défaut pour les écrits d'auteurs)
- Conserver le style, le niveau de familiarité et le vocabulaire spécifique de l'auteur.
- Éliminer uniquement les tics mécaniques de machine (transitions mortes, faux contrastes, emojis, remplissages).
- Ne pas chercher à "uniformiser" ou rendre académique une note personnelle ou un retour de bug.

### Mode Conforme (Documentation officielle & Livrables d'entreprise)
- Appliquer rigoureusement la charte d'ingénierie : ton neutre, factuel, concis, vocabulaire technique précis.
- Aucun emballage marketing, aucun adverbe d'intensité superflu (*« véritablement »*, *« extrêmement »*).
- Formater les exemples de code avec des types stricts et des commandes reproductibles.

---

## 4. Automatisation & Contrôle Qualité

Le contrôle qualité textuel est automatisé dans notre chaîne d'intégration :
- **Script local** : `scripts/audit-slop.py` (script Python autonome, zéro dépendance, bibliothèque standard).
- **Vérification CI** : Exécuté sur les fichiers Markdown dans `.github/workflows/ci.yml` et `.gitlab-ci.yml`.
- **Commande de vérification** :
  ```bash
  python3 scripts/audit-slop.py README.md guides/*.md checklists/*.md
  ```
