# Guide Clean Code & Production Node.js

> **Sources de référence condensées** : `references/clean-code-javascript`, `references/nodebestpractices`, `references/javascript`.

Ce guide condense les règles fondamentales pour garantir un code propre, lisible, modulaire et tolérant aux pannes dans un environnement Node.js / TypeScript.

---

## 1. Gestion des Erreurs : Les Règles d'Or de Production

### 1.1 Utiliser exclusivement des erreurs typées (héritant de `Error`)
*Ne jamais renvoyer ou throw de simples chaînes ou objets anonymes.*

```typescript
//  VRAI : Hiérarchie d'erreurs applicatives
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    public readonly details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(`${resource} avec l'identifiant ${id} est introuvable.`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("Données d'entrée invalides.", 400, true, details);
  }
}
```

### 1.2 Distinguer les erreurs opérationnelles des erreurs de programmation
- **Erreurs opérationnelles** : Requête invalide, ressource non trouvée, timeout externe. L'application les gère avec élégance, répond au client et continue de tourner.
- **Erreurs de programmation (Bugs critiques)** : Null pointer imprévu, mémoire saturée, syntaxe défaillante. L'application doit logguer le crash et **redémarrer proprement** (géré par process manager : PM2 / Docker / Kubernetes).

### 1.3 Capturer les rejets non gérés au niveau du processus
```typescript
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('CRITICAL: Promesse rejetée non gérée', { reason });
  // Permet de crasher proprement pour redémarrer
  throw reason;
});

process.on('uncaughtException', (error: Error) => {
  logger.error('FATAL: Exception non capturée', { error });
  process.exit(1); // Le superviseur (Docker/PM2) relance le conteneur
});
```

---

## 2. Principes Clean Code (SOLID & Lisibilité)

### 2.1 Single Responsibility Principle (SRP)
*Une fonction ou classe ne doit avoir qu'une seule raison de changer.*

```typescript
//  FAUX : La fonction fait de la validation, de la persistance, et de l'envoi d'email
async function registerUser(data: any) {
  if (!data.email.includes('@')) throw new Error('Invalid');
  const user = await db.user.create({ data });
  await sendgrid.sendEmail({ to: user.email, subject: 'Welcome' });
  return user;
}

//  VRAI : Séparation en cas d'usage orchestrant des dépendances injectées
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly mailer: MailerService,
    private readonly validator: SchemaValidator
  ) {}

  async execute(dto: RegisterUserDto): Promise<User> {
    const validated = this.validator.validate(dto);
    const user = await this.userRepository.create(validated);
    await this.mailer.sendWelcomeEmail(user.email);
    return user;
  }
}
```

### 2.2 Préférer les fonctions pures et l'immutabilité
Éviter d'altérer les tableaux et objets passés en arguments.
```typescript
//  FAUX : Mutation de l'argument d'origine
function applyDiscount(cart: Cart, discount: number) {
  cart.items.forEach(item => { item.price -= discount; });
  return cart;
}

//  VRAI : Nouvelle instance retournée sans effet de bord
function applyDiscount(cart: Cart, discount: number): Cart {
  return {
    ...cart,
    items: cart.items.map(item => ({
      ...item,
      price: Math.max(0, item.price - discount),
    })),
  };
}
```

---

## 3. Santé du Processus Node.js & Event Loop

- **Ne jamais bloquer l'Event Loop** : Bannir les méthodes synchrones (`fs.readFileSync`, `crypto.pbkdf2Sync` dans les requêtes Web) et les calculs CPU intenses sur le thread principal (déléguer à des Worker Threads ou files de messages Redis/BullMQ).
- **Arrêt gracieux (Graceful Shutdown)** :
```typescript
async function gracefulShutdown(signal: string) {
  logger.info(`Signal ${signal} reçu. Fermeture des connexions...`);
  server.close(async () => {
    await db.$disconnect();
    await redisClient.quit();
    logger.info('Connexions clôturées avec succès. Sortie.');
    process.exit(0);
  });

  // Forcer la fermeture après un timeout si un handler est bloqué
  setTimeout(() => {
    logger.error('Arrêt forcé après expiration du timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```
