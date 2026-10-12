import { Databases, Client } from "node-appwrite";

export interface MigrationMetadata {
  /** Unique 12-char hex identifier for this revision */
  versionId: string;
  /** Identifier of the migration preceding this one, or null for initial migration */
  previousVersionId: string | null;
  /** Human-readable name/description */
  name: string;
  /** Author or system creator */
  author: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

export interface Migration {
  metadata: MigrationMetadata;
  /** Forward migration logic */
  up: (databases: Databases, dbId: string) => Promise<void>;
  /** Rollback / revert logic */
  down: (databases: Databases, dbId: string) => Promise<void>;
}

export interface MigrateConfig {
  /** Appwrite instance endpoint URL, e.g. https://cloud.appwrite.io/v1 */
  endpoint?: string;
  /** Appwrite Project ID */
  projectId?: string;
  /** Appwrite Server API Key (requires databases read/write permissions) */
  apiKey?: string;
  /** Target Appwrite Database ID. If empty or omitted, auto-detects the first database */
  databaseId?: string;
  /** Path to migrations folder relative to project root. Defaults to "./database/migrations" */
  migrationsDir?: string;
  /** Optional custom Client instance */
  client?: Client;
  /** Optional custom Databases instance (e.g. for custom or legacy self-hosted Appwrite versions) */
  databases?: Databases;
}

/**
 * Type-safe configuration helper for appwrite-migrate.config.ts
 */
export function defineConfig(config: MigrateConfig): MigrateConfig {
  return config;
}
