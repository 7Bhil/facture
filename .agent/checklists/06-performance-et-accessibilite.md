# Checklist 06 : Performance Web & Accessibilité Numérique (a11y)

*Sources d'inspiration : `references/Front-End-Performance-Checklist`, `references/wcag`, `references/aria`*

---

## 1. Performance Web & Core Web Vitals

- [ ] **LCP (Largest Contentful Paint)** :
  - Préchargement des ressources critiques (`rel="preload"` sur polices critiques ou hero image).
  - Optimisation et compression des images (formats AVIF / WebP, dimensions explicites pour éviter le reflow).
- [ ] **INP (Interaction to Next Paint) / Event Loop Node.js** :
  - Éviter les tâches JavaScript longues bloquant le fil d'exécution principal (> 50ms).
  - En Node.js, ne jamais bloquer l'Event Loop avec des opérations CPU intensives (ex: calculs cryptographiques synchrones, `fs.readFileSync`).
- [ ] **CLS (Cumulative Layout Shift)** :
  - Toujours réserver l'espace pour les images, bannières et iframes avec `width`, `height` ou `aspect-ratio` en CSS.
- [ ] **Pagination et Volumétrie** :
  - Aucune requête API ne renvoie de collection sans pagination explicite (curseur ou offset + limite maximale stricte).

---

## 2. Accessibilité Numérique (WCAG 2.2 & ARIA)

- [ ] **HTML Sémantique d'abord** :
  - Préférer systématiquement les éléments natifs (`<button>`, `<dialog>`, `<nav>`, `<main>`, `<article>`) plutôt que des `<div>` ou `<span>` avec des listeners `onClick`.
- [ ] **Accessibilité Clavier intégrale** :
  - Tout composant interactif doit être atteignable et utilisable via `Tab`, `Enter`, `Espace`, `Échap`.
  - Pas de suppression du contour de focus (`outline: none`) sans alternative visible et contrastée.
- [ ] **Contraste des Couleurs (WCAG AA)** :
  - Ratio de contraste minimal de 4.5:1 pour le texte normal, 3:1 pour le texte grand format.
- [ ] **Attributs ARIA pertinents** :
  - Ne pas surcharger en ARIA quand le HTML natif suffit.
  - Fournir des `aria-label`, `aria-expanded`, `aria-haspopup` et `role="status"` ou `role="alert"` lorsque les mises à jour dynamiques nécessitent d'être annoncées aux lecteurs d'écran.
