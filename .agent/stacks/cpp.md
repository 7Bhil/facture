# Règles Senior : C & C++ Moderne

> **Standards de référence** : C++20 / C++23, C Core Guidelines, ISO/IEC 14882, CERT C/C++.

---

## 1. Gestion de la Mémoire & Cycle de Vie des Ressources

- **Application stricte du RAII (Resource Acquisition Is Initialization)** :
  - Toute ressource (mémoire sur le tas, descripteur de fichier, mutex, socket réseau) doit être encapsulée dans un objet dont le destructeur libère la ressource automatiquement.
  - Bannir l'utilisation directe de `malloc`/`free` et des paires `new`/`delete` nues.
- **Pointeurs Intelligents (Smart Pointers)** :
  - `std::unique_ptr` par défaut pour formaliser la propriété exclusive sans surcoût d'indirection. Initialiser via `std::make_unique`.
  - `std::shared_ptr` uniquement lorsque la propriété est partagée de manière non déterministe entre plusieurs entités. Initialiser via `std::make_shared`.
  - `std::weak_ptr` pour briser les cycles de références circulaires pouvant causer des fuites de mémoire.
  - Passer les objets par référence constante (`const T&`) ou par valeur avec déplacement (`std::move`) pour éviter les copies coûteuses.
- **Règle des Zéro, Trois ou Cinq** :
  - Privilégier la *Règle de Zéro* : concevoir les classes avec des membres gérant eux-mêmes leur cycle de vie (`std::string`, `std::vector`, `std::unique_ptr`).
  - Si une gestion manuelle est requise, définir explicitement le destructeur, le constructeur par copie, l'opérateur d'assignation par copie, le constructeur par déplacement et l'opérateur d'assignation par déplacement.

---

## 2. Robustesse, Sécurité & Typage Moderne

- **Bannissement des Comportements Indéterminés (Undefined Behavior)** :
  - Activer systématiquement les sanitizers à la compilation (`-fsanitize=address,undefined,leak`).
  - Valider strictement les bornes des conteneurs : préférer `std::span` et `std::string_view` aux tableaux bruts style C (`char*`, `T[]`).
  - Utiliser `at()` ou des contrôles explicites de bornes lorsque l'index n'est pas garanti par construction.
- **Const-Correctness & Immutabilité** :
  - Marquer `const` toute variable, référence, pointeur et méthode membre ne modifiant pas l'état interne.
  - Utiliser `constexpr` et `consteval` pour exécuter les calculs déterministes à la compilation et réduire la charge d'exécution.
- **Concepts & Templates C++20** :
  - Restreindre les types génériques avec des `concepts` clairs plutôt que d'utiliser des templates non contraints ou du SFINAE complexe.
- **Gestion des Erreurs Typée** :
  - Réserver les exceptions (`std::runtime_error`) aux défaillances exceptionnelles réelles.
  - Pour les flux opérationnels faillibles, utiliser `std::optional` ou `std::expected` (C++23) afin de rendre l'échec explicite dans la signature de la fonction.

---

## 3. Tooling, Build & Structuration de Projet

- **CMake Moderne (Target-based)** :
  - Structurer les projets avec des cibles explicites : `add_library(...)`, `add_executable(...)`.
  - Isoler les dépendances et chemins d'en-têtes via `target_include_directories(...)`, `target_link_libraries(...)` et `target_compile_features(...)` avec visibilité `PRIVATE`, `PUBLIC` ou `INTERFACE`.
  - Bannir les commandes globales obsolètes (`include_directories`, `link_libraries`).
- **Outillage & Analyse Statique** :
  - Intégrer `clang-tidy` et `clang-format` dans les pipelines d'intégration continue.
  - Compiler avec un niveau d'avertissement maximal : `-Wall -Wextra -Wpedantic -Wconversion -Werror`.
