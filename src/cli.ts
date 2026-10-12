import { MigrationEngine } from "./engine";
import { generateTemplate } from "./template";
import { MigrationMetadata } from "./types";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const command = args[0];

function generateId(): string {
  return crypto.randomBytes(6).toString("hex"); // 12 char hex string
}

async function run() {
  if (command === "init") {
    const configPath = path.resolve(process.cwd(), "appwrite-migrate.config.ts");
    const migrationsDir = path.resolve(process.cwd(), "database/migrations");

    if (!fs.existsSync(configPath)) {
      const template = `import "dotenv/config";
import { defineConfig } from "appwrite-migrate";

export default defineConfig({
  endpoint: process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  apiKey: process.env.APPWRITE_API_KEY || "",
  databaseId: process.env.APPWRITE_DATABASE_ID || "", // Leave empty to auto-detect the first database
  migrationsDir: "./database/migrations",
});
`;
      fs.writeFileSync(configPath, template);
      console.log(`✓ Created configuration file: ${configPath}`);
    } else {
      console.log(`ℹ Configuration file already exists: ${configPath}`);
    }

    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log(`✓ Created migrations directory: ${migrationsDir}`);
    }
    return;
  }

  const engine = new MigrationEngine();

  if (command === "create") {
    await engine.ensureInitialized();
    let name = "migration";
    const nameIndex = args.indexOf("-n");
    if (nameIndex > -1 && args[nameIndex + 1]) {
      name = args[nameIndex + 1];
    } else if (args[1] && !args[1].startsWith("-")) {
      name = args[1];
    }

    // Find the latest migration in local to set previousVersionId
    const locals = await engine.getLocalMigrations();
    const lastLocal = locals.length > 0 ? locals[locals.length - 1].migration.metadata.versionId : null;

    const versionId = generateId();

    const metadata: MigrationMetadata = {
      versionId,
      previousVersionId: lastLocal,
      name,
      author: process.env.USER || "system",
      createdAt: new Date().toISOString(),
    };

    const templateString = generateTemplate(metadata);
    const fileName = `${versionId}_${name}.ts`;
    const fullPath = path.join(engine.migrationsDir, fileName);

    if (!fs.existsSync(engine.migrationsDir)) {
      fs.mkdirSync(engine.migrationsDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, templateString);
    console.log(`✓ Created new migration: ${fullPath}`);
    return;
  }

  if (command === "up") {
    const subCommand = args[1];
    if (subCommand === "latest") {
      await engine.upgrade();
    } else if (!subCommand) {
      await engine.upgrade(undefined, true);
    } else {
      await engine.upgrade(subCommand);
    }
    return;
  }

  if (command === "down") {
    const subCommand = args[1];
    if (!subCommand) {
      await engine.downgrade(undefined, true);
    } else {
      await engine.downgrade(subCommand);
    }
    return;
  }

  if (command === "status") {
    const { applied, pending } = await engine.status();
    console.log(`\n=== Appwrite Migration Status ===`);
    console.log(`Applied migrations (${applied.length}):`);
    if (applied.length === 0) {
      console.log("  (None)");
    } else {
      applied.forEach((id) => console.log(`  ✓ ${id}`));
    }

    console.log(`\nPending migrations (${pending.length}):`);
    if (pending.length === 0) {
      console.log("  (None)");
    } else {
      pending.forEach((p) =>
        console.log(`  ○ ${p.migration.metadata.versionId} - ${p.migration.metadata.name} (${p.file})`)
      );
    }
    console.log("");
    return;
  }

  console.log(`
Appwrite Migrate CLI

Usage:
  npx appwrite-migrate init                 Scaffolds config and migrations folder
  npx appwrite-migrate create [name]        Creates a new migration file (-n [name])
  npx appwrite-migrate up                   Runs exactly one pending migration
  npx appwrite-migrate up latest            Runs all pending migrations
  npx appwrite-migrate up [hash]            Runs pending migrations up to hash
  npx appwrite-migrate down                 Reverts exactly one applied migration
  npx appwrite-migrate down [hash]          Reverts applied migrations down to hash
  npx appwrite-migrate status               Shows applied and pending migrations
`);
}

run().catch((err) => {
  console.error("Migration Runner Error:", err);
  process.exit(1);
});
