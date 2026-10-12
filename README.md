# appwrite-migrate 🚀

> A powerful, Alembic-style schema migration runner and CLI for [Appwrite](https://appwrite.io).

[![npm version](https://img.shields.io/npm/v/appwrite-migrate.svg)](https://www.npmjs.com/package/appwrite-migrate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Managing schema evolutions, collections, attributes, and indexes across development, staging, and production Appwrite instances shouldn't be manual. `appwrite-migrate` brings deterministic, reproducible database migrations to Appwrite.

---

## ✨ Features

- **Alembic-style Revisions**: Each migration has a unique 12-character version hash and links to its `previousVersionId`, creating an unambiguous, ordered dependency chain.
- **Bi-directional**: Supports forward (`up`) migrations and safe rollbacks (`down`).
- **Automatic State Tracking**: Automatically manages an `appwrite_migrations` collection in your Appwrite database to record applied migrations with timestamps.
- **Rollback Safety**: If a migration fails halfway, `appwrite-migrate` catches the error and executes the `down` handler to keep your schema clean.
- **First-Class TypeScript**: Write migration scripts in TypeScript with complete type safety and autocompletion for Appwrite SDK methods.
- **Zero-Friction CLI**: Run single-step migrations, migrate up to a target hash, or run all pending migrations with `npx appwrite-migrate up latest`.
- **Programmatic API**: Use the `MigrationEngine` directly inside serverless functions, CI/CD pipelines, or deployment scripts.

---

## 📦 Installation

```bash
npm install --save-dev appwrite-migrate
# or
pnpm add -D appwrite-migrate
# or
yarn add -D appwrite-migrate
```

> **Zero hassle**: `node-appwrite` is bundled and re-exported. No need to manage separate SDK dependencies!

---

## 🚀 Quick Start

### 1. Initialize Configuration

Run the initialization command in your project root:

```bash
npx appwrite-migrate init
```

This generates `appwrite-migrate.config.ts` and creates the `./database/migrations` directory.

### 2. Configure Credentials

Update your `appwrite-migrate.config.ts` or add your keys to `.env` / `.env.local`:

```typescript
// appwrite-migrate.config.ts
import "dotenv/config";
import { defineConfig } from "appwrite-migrate";

export default defineConfig({
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  apiKey: process.env.APPWRITE_API_KEY || "", // Server API Key with Databases scope
  databaseId: "", // Leave empty to auto-detect the first database
  migrationsDir: "./database/migrations",
});
```

### 3. Create Your First Migration

```bash
npx appwrite-migrate create -n create_users_collection
```

This generates a timestamped migration file in `./database/migrations/`:

```typescript
import { Migration, Databases, ID } from "appwrite-migrate";

export const migration: Migration = {
  metadata: {
    versionId: "e9f2a1b4c6d8",
    previousVersionId: null,
    name: "create_users_collection",
    author: "developer",
    createdAt: "2026-10-13T00:00:00.000Z"
  },

  up: async (databases: Databases, dbId: string) => {
    await databases.createCollection(dbId, "users", "Users");
    await databases.createStringAttribute(dbId, "users", "email", 255, true);
    await databases.createStringAttribute(dbId, "users", "name", 128, false);
  },

  down: async (databases: Databases, dbId: string) => {
    await databases.deleteCollection(dbId, "users");
  }
};
```

### 4. Run Migrations

```bash
# Run all pending migrations
npx appwrite-migrate up latest

# Run exactly one migration
npx appwrite-migrate up

# Check status of applied vs pending migrations
npx appwrite-migrate status

# Revert the most recent migration
npx appwrite-migrate down
```

---

## 📖 CLI Commands

| Command | Description |
| :--- | :--- |
| `npx appwrite-migrate init` | Scaffolds `appwrite-migrate.config.ts` and migrations directory. |
| `npx appwrite-migrate create -n <name>` | Generates a new migration with linked `previousVersionId`. |
| `npx appwrite-migrate up` | Runs exactly one pending migration. |
| `npx appwrite-migrate up latest` | Runs all pending migrations. |
| `npx appwrite-migrate up <versionId>` | Runs pending migrations up to and including `<versionId>`. |
| `npx appwrite-migrate down` | Reverts exactly one applied migration. |
| `npx appwrite-migrate down <versionId>` | Reverts applied migrations down to and including `<versionId>`. |
| `npx appwrite-migrate status` | Displays the status of applied and pending migrations. |

---

## 🛠️ Programmatic API

You can also run migrations programmatically inside your backend or deployment scripts:

```typescript
import { MigrationEngine } from "appwrite-migrate";

const engine = new MigrationEngine({
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "your-project-id",
  apiKey: "your-secret-api-key",
  databaseId: "main",
  migrationsDir: "./database/migrations",
});

// Run all pending migrations
await engine.upgrade();

// Inspect applied vs pending migrations
const { applied, pending } = await engine.status();
console.log(`Applied: ${applied.length}, Pending: ${pending.length}`);
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
