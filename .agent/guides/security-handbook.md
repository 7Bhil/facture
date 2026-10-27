# Guide de Sécurité Offensive & Défensive pour Agents

> **Sources de référence condensées** : `references/Top10`, `references/API-Security`, `references/ASVS`, `references/CheatSheetSeries`.

Ce guide regroupe les règles non négociables qu'un agent senior doit appliquer pour chaque ligne de code touchant aux données, à l'authentification ou aux APIs.

---

## 1. Top Vulnérabilités & Patrons de Défense (Do & Don't)

### API1:2023 / A01:2021 - BOLA / IDOR (Broken Object Level Authorization)
L'attaquant manipule l'ID d'un objet dans une requête (`/api/invoices/1042`) pour accéder aux données d'un tiers.

* **DON'T (Vulnérable)** :
```typescript
//  FAUX : Vérifie que l'utilisateur est connecté, mais pas propriétaire de la facture !
app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  return res.json(invoice);
});
```

* **DO (Sécurisé - Scoping obligatoire)** :
```typescript
//  VRAI : L'accès est restreint par l'organisation ou l'identifiant du token authentifié
app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      tenantId: req.user.tenantId, // Scoping strict au tenant de la session
    },
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  return res.json(invoice);
});
```

---

### A03:2021 - Injection (SQL, NoSQL, Commande OS)
Concaténer ou interpoler des variables non fiables dans une requête ou une commande système.

* **DON'T (Vulnérable)** :
```typescript
//  FAUX : Injection SQL triviale
const users = await db.query(`SELECT * FROM users WHERE email = '${req.body.email}'`);

//  FAUX : Exécution shell avec entrée non assainie
exec(`convert ${req.body.filename} output.png`);
```

* **DO (Sécurisé - Paramétrage strict & APIs sans shell)** :
```typescript
//  VRAI : Requête paramétrée préparée
const users = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);

//  VRAI : Pas de sous-shell bash, passage d'arguments isolés
execFile('convert', [validatedFilename, 'output.png']);
```

---

### API3:2023 - Broken Object Property Level Authorization (Mass Assignment)
Permettre à un client de modifier des champs internes sensibles (`isAdmin`, `role`, `balance`, `verified`).

* **DON'T (Vulnérable)** :
```typescript
//  FAUX : Injection directe du body sans whitelist
await prisma.user.update({
  where: { id: req.user.id },
  data: req.body, // L'attaquant injecte { role: 'ADMIN' }
});
```

* **DO (Sécurisé - Validation stricte par schéma DTO)** :
```typescript
//  VRAI : Seuls les champs explicitement autorisés sont extraits
const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  bio: z.string().max(280).optional(),
}).strict(); // Rejette toute propriété supplémentaire

const payload = UpdateProfileSchema.parse(req.body);
await prisma.user.update({
  where: { id: req.user.id },
  data: payload,
});
```

---

### A10:2021 / API7:2023 - SSRF (Server-Side Request Forgery)
Le serveur effectue un appel HTTP vers une URL fournie par l'utilisateur sans validation d'IP interne (accès possible aux métadonnées cloud `169.254.169.254` ou réseaux internes `10.0.0.0/8`, `127.0.0.1`).

* **DO (Sécurisé)** :
```typescript
//  VRAI : Valider le protocole et bannir les plages IP privées/locales
import ipaddr from 'ipaddr.js';
import dns from 'node:dns/promises';

async function validateSafeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ValidationError('Protocole non autorisé');
  }
  const { address } = await dns.lookup(url.hostname);
  const parsed = ipaddr.parse(address);
  if (parsed.range() !== 'unicast') {
    throw new SecurityError('Accès réseau privé ou interne interdit');
  }
  return url;
}
```

---

## 2. En-têtes HTTP de Sécurité Obligatoires (Helmet & CORS)

```typescript
import helmet from 'helmet';
import cors from 'cors';

// 1. Headers de sécurité stricts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"], // Anti-Clickjacking
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// 2. CORS restrictif : pas d'étoile (*) en production
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? 'https://app.monprojet.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## 3. Stockage Sécurisé des Mots de Passe & Sessions

- **Hashage des mots de passe** : Utiliser exclusivement `argon2id` (ou `bcrypt` avec un coût >= 12). Ne jamais utiliser SHA-256, SHA-512 ou MD5 sans salage/itération lente.
- **Cookies de Session** :
  ```typescript
  res.cookie('token', token, {
    httpOnly: true,  // Protège contre le vol via XSS
    secure: true,    // HTTPS uniquement
    sameSite: 'lax', // Protection CSRF
    maxAge: 3600000, // 1 heure
  });
  ```
- **Gestion des Secrets** : Valider toutes les variables d'environnement critiques au démarrage de l'application via un schéma (ex: `zod` ou `envalid`) et planter immédiatement si une variable manque (*Fail Fast*).
