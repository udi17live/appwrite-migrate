import { Client, Databases, ID, Query } from "node-appwrite";
import fs from "fs";
import path from "path";
import { Migration, MigrateConfig } from "./types";
import { resolveConfig } from "./config";

const MIGRATIONS_COLLECTION = "appwrite_migrations";

export class MigrationEngine {
  client!: Client;
  databases!: Databases;
  dbId: string = "";
  migrationsDir: string = "./database/migrations";
  config?: MigrateConfig;
  private initialized: boolean = false;

  constructor(customConfig?: Partial<MigrateConfig>) {
    if (
      customConfig &&
      (customConfig.databases ||
        (customConfig.endpoint && customConfig.projectId && customConfig.apiKey))
    ) {
      this.applyConfig(customConfig as MigrateConfig);
    }
  }

  private applyConfig(cfg: MigrateConfig) {
    this.config = cfg;
    if (cfg.databases) {
      this.databases = cfg.databases;
      this.client = (cfg.databases as any).client || cfg.client;
    } else if (cfg.client) {
      this.client = cfg.client;
      this.databases = new Databases(this.client);
    } else {
      this.client = new Client()
        .setEndpoint(cfg.endpoint!)
        .setProject(cfg.projectId!)
        .setKey(cfg.apiKey!);
      this.databases = new Databases(this.client);
    }

    this.migrationsDir = path.resolve(process.cwd(), cfg.migrationsDir || "./database/migrations");
    this.dbId = cfg.databaseId || "";
    this.initialized = true;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      const resolved = await resolveConfig(process.cwd(), this.config);
      if (
        !resolved.databases &&
        (!resolved.endpoint || !resolved.projectId || !resolved.apiKey)
      ) {
        throw new Error(
          "Missing Appwrite credentials. Please configure endpoint, projectId, and apiKey via appwrite-migrate.config.ts, environment variables, or pass a custom databases instance."
        );
      }
      this.applyConfig(resolved);
    }
  }
  
  async ensureDatabase() {
    await this.ensureInitialized();
    if (!this.dbId) {
      const dbs = await this.databases.list();
      if (dbs.total > 0) {
        this.dbId = dbs.databases[0].$id;
      } else {
        console.log("No database found. Creating 'main' database...");
        const db = await this.databases.create(ID.unique(), 'main');
        this.dbId = db.$id;
      }
    }
  }

  private async safeCreateStringAttribute(
    dbId: string,
    collId: string,
    key: string,
    size: number,
    required: boolean
  ) {
    try {
      // Modern SDK (v18+) named parameters
      await (this.databases.createStringAttribute as any)({
        databaseId: dbId,
        collectionId: collId,
        key,
        size,
        required,
      });
    } catch {
      // Fallback for legacy SDKs / positional parameter overloads
      await (this.databases.createStringAttribute as any)(dbId, collId, key, size, required);
    }
  }

  private async safeCreateDatetimeAttribute(
    dbId: string,
    collId: string,
    key: string,
    required: boolean
  ) {
    try {
      // Modern SDK (v18+) named parameters
      await (this.databases.createDatetimeAttribute as any)({
        databaseId: dbId,
        collectionId: collId,
        key,
        required,
      });
    } catch {
      // Fallback for legacy SDKs / positional parameter overloads
      await (this.databases.createDatetimeAttribute as any)(dbId, collId, key, required);
    }
  }

  async setup() {
    await this.ensureDatabase();
    try {
      await this.databases.getCollection(this.dbId, MIGRATIONS_COLLECTION);
    } catch (e: any) {
      if (e.code === 404) {
        console.log("Setting up _appwrite_migrations collection...");
        await this.databases.createCollection(this.dbId, MIGRATIONS_COLLECTION, 'Appwrite Migrations');
        await this.safeCreateStringAttribute(this.dbId, MIGRATIONS_COLLECTION, 'versionId', 50, true);
        await this.safeCreateStringAttribute(this.dbId, MIGRATIONS_COLLECTION, 'name', 255, true);
        await this.safeCreateDatetimeAttribute(this.dbId, MIGRATIONS_COLLECTION, 'appliedAt', true);
        // Wait a bit for attributes to be provisioned
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw e;
      }
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    await this.ensureDatabase();
    const docs = await this.databases.listDocuments(this.dbId, MIGRATIONS_COLLECTION, [
        Query.limit(100),
        Query.orderAsc('appliedAt') // order of application
    ]);
    return docs.documents.map(d => d.versionId);
  }

  async getLocalMigrations(): Promise<{ file: string, migration: Migration }[]> {
    await this.ensureInitialized();
    if (!fs.existsSync(this.migrationsDir)) {
        fs.mkdirSync(this.migrationsDir, { recursive: true });
    }
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => (f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".mjs")) && !f.endsWith(".d.ts"));

    const unsorted = [];
    for (const file of files) {
      const fullPath = path.join(this.migrationsDir, file);
      // Import the migration file dynamically
      const imported = await import(`file://${fullPath}?t=${Date.now()}`);
      if (imported.migration) {
         unsorted.push({ file, migration: imported.migration });
      }
    }
    
    // Sort topologically based on previousVersionId (like Alembic)
    const sorted = [];
    let current = unsorted.find(m => m.migration.metadata.previousVersionId === null);
    
    // Fallback if the very first migration was deleted manually by the user
    if (!current && unsorted.length > 0) {
      const allIds = unsorted.map(m => m.migration.metadata.versionId);
      current = unsorted.find(m => m.migration.metadata.previousVersionId && !allIds.includes(m.migration.metadata.previousVersionId));
    }

    while (current) {
      sorted.push(current);
      const nextId = current.migration.metadata.versionId;
      current = unsorted.find(m => m.migration.metadata.previousVersionId === nextId);
    }
    
    // Safety fallback for any disconnected branches
    for (const m of unsorted) {
      if (!sorted.includes(m)) sorted.push(m);
    }

    return sorted;
  }

  async upgrade(targetHash?: string, singleStep: boolean = false) {
    await this.setup();
    const applied = await this.getAppliedMigrations();
    const locals = await this.getLocalMigrations();
    
    // Find pending
    const pending = locals.filter(l => !applied.includes(l.migration.metadata.versionId));
    
    if (pending.length === 0) {
      console.log("Database is up to date.");
      return;
    }

    for (const { file, migration } of pending) {
      console.log(`[UP] Applying ${migration.metadata.versionId}_${migration.metadata.name}...`);
      try {
        await migration.up(this.databases, this.dbId);
        // Stamp
        await this.databases.createDocument(this.dbId, MIGRATIONS_COLLECTION, ID.unique(), {
            versionId: migration.metadata.versionId,
            name: migration.metadata.name,
            appliedAt: new Date().toISOString()
        });
        console.log(`  -> Applied successfully.`);
        
        if (targetHash && migration.metadata.versionId === targetHash) {
          console.log(`Reached target hash ${targetHash}. Stopping.`);
          break;
        }
        if (singleStep) {
           break;
        }
      } catch (err: any) {
        console.error(`  -> Failed applying ${migration.metadata.versionId}: ${err.message}`);
        console.log(`  -> Attempting rollback of ${migration.metadata.versionId}...`);
        try {
           await migration.down(this.databases, this.dbId);
           console.log(`  -> Rollback successful.`);
        } catch (rollbackErr: any) {
           console.error(`  -> Rollback failed: ${rollbackErr.message}`);
        }
        throw err;
      }
    }
  }

  async downgrade(targetHash?: string, singleStep: boolean = false) {
    await this.setup();
    const locals = await this.getLocalMigrations();
    const docs = await this.databases.listDocuments(this.dbId, MIGRATIONS_COLLECTION, [
      Query.limit(100),
      Query.orderDesc('appliedAt') // Get most recent first
    ]);

    if (docs.documents.length === 0) {
      console.log("No migrations applied. Nothing to downgrade.");
      return;
    }

    for (const doc of docs.documents) {
       const localMatch = locals.find(l => l.migration.metadata.versionId === doc.versionId);
       if (!localMatch) {
         console.warn(`Warning: Applied migration ${doc.versionId} missing from local files. Cannot downgrade safely.`);
         continue;
       }

       const { migration } = localMatch;
       console.log(`[DOWN] Reverting ${migration.metadata.versionId}_${migration.metadata.name}...`);
       
       try {
         await migration.down(this.databases, this.dbId);
         await this.databases.deleteDocument(this.dbId, MIGRATIONS_COLLECTION, doc.$id);
         console.log(`  -> Reverted successfully.`);
         
         if (targetHash && migration.metadata.versionId === targetHash) {
            console.log(`Reverted target hash ${targetHash}. Stopping.`);
            break;
         }
         if (singleStep) {
            break;
         }
       } catch (err: any) {
          console.error(`  -> Failed reverting ${migration.metadata.versionId}: ${err.message}`);
          throw err;
       }
    }
  }

  async status(): Promise<{ applied: string[]; pending: { file: string; migration: Migration }[] }> {
    await this.setup();
    const applied = await this.getAppliedMigrations();
    const locals = await this.getLocalMigrations();
    const pending = locals.filter(l => !applied.includes(l.migration.metadata.versionId));
    return { applied, pending };
  }
}
