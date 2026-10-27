# Guide Performance Web & Accessibilité Numérique (a11y)

> **Sources de référence condensées** : `references/Front-End-Performance-Checklist`, `references/wcag`, `references/aria`.

---

## 1. Performance Web & Core Web Vitals

### 1.1 LCP (Largest Contentful Paint) < 2.5s
- **Images Hero** : Préchargement explicite dans le `<head>` avec `<link rel="preload" as="image" href="..." fetchpriority="high">`.
- **Formats d'image modernes** : Servir en `AVIF` ou `WebP` avec compression adaptée.
- **Dimensions fixes** : Toujours spécifier `width` et `height` ou un ratio CSS (`aspect-ratio: 16/9`) pour éliminer tout **CLS (Cumulative Layout Shift)**.

### 1.2 INP (Interaction to Next Paint) < 200ms
- **Découpage des tâches JavaScript** : Éviter les calculs synchrones bloquants supérieurs à 50ms sur le fil d'exécution UI.
- Utiliser `requestAnimationFrame` ou `scheduler.yield()` pour céder la main au navigateur lors des traitements longs.

---

## 2. Accessibilité Numérique (WCAG 2.2 AA & WAI-ARIA)

### 2.1 HTML Sémantique : Le Premier Principe de l'Accessibilité
-  Pas de `<div onClick={handleClick}>` : Ne supporte ni le focus clavier natif, ni la vocalisation écran, ni la touche `Enter`/`Espace`.
-  Toujours utiliser un vrai élément `<button type="button">`.

### 2.2 Navigation Clavier & Visibilité du Focus
- **Ne jamais supprimer le contour de focus sans alternative visible** :
```css
/*  INTERDIT */
*:focus { outline: none; }

/*  AUTORISÉ : Focus ring visible et contrasté */
*:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
```

### 2.3 Ratios de Contraste de Couleur
- **Texte normal** : Contraste minimal de **4.5:1** contre son arrière-plan.
- **Texte large (>= 18pt ou >= 14pt gras)** : Contraste minimal de **3:1**.
- **Composants d'interface & icônes interactives** : Contraste minimal de **3:1**.

### 2.4 Utilisation Ciblée d'ARIA
- **Règle #1 d'ARIA** : Si un élément HTML natif existe (`<nav>`, `<main>`, `<dialog>`, `<button>`), **ne pas utiliser ARIA**.
- Utiliser `aria-live="polite"` pour les messages d'état ou notifications dynamiques, et `aria-expanded="true/false"` sur les menus accordéons déroulants.
