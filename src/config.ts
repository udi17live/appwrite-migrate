import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { MigrateConfig } from "./types";

/**
 * Loads .env and .env.local from the target project working directory.
 */
export function loadEnv(cwd: string = process.cwd()): void {
  const envLocal = path.resolve(cwd, ".env.local");
  const envMain = path.resolve(cwd, ".env");

  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal });
  }
  if (fs.existsSync(envMain)) {
    dotenv.config({ path: envMain });
  }
}

/**
 * Resolves configuration from config files, environment variables, or programmatic overrides.
 */
export async function resolveConfig(
  cwd: string = process.cwd(),
  customConfig?: Partial<MigrateConfig>
): Promise<MigrateConfig> {
  loadEnv(cwd);

  let fileConfig: Partial<MigrateConfig> = {};
  const configCandidates = [
    "appwrite-migrate.config.ts",
    "appwrite-migrate.config.mts",
    "appwrite-migrate.config.mjs",
    "appwrite-migrate.config.js",
    "appwrite-migrate.config.cjs",
    "appwrite-migrate.config.json",
  ];

  for (const file of configCandidates) {
    const fullPath = path.resolve(cwd, file);
    if (fs.existsSync(fullPath)) {
      if (file.endsWith(".json")) {
        try {
          fileConfig = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
          break;
        } catch (e: any) {
          console.warn(`[appwrite-migrate] Could not parse ${file}: ${e.message}`);
        }
      } else {
        try {
          const imported = await import(`file://${fullPath}?t=${Date.now()}`);
          fileConfig = imported.default || imported;
          break;
        } catch (e: any) {
          // In environments without native TS execution, we fallback gracefully to env variables
        }
      }
    }
  }

  const endpoint =
    customConfig?.endpoint ||
    fileConfig?.endpoint ||
    process.env.APPWRITE_ENDPOINT ||
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    "";

  const projectId =
    customConfig?.projectId ||
    fileConfig?.projectId ||
    process.env.APPWRITE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
    "";

  const apiKey =
    customConfig?.apiKey ||
    fileConfig?.apiKey ||
    process.env.APPWRITE_API_KEY ||
    "";

  const databaseId =
    customConfig?.databaseId !== undefined
      ? customConfig.databaseId
      : fileConfig?.databaseId !== undefined
      ? fileConfig.databaseId
      : process.env.APPWRITE_DATABASE_ID || "";

  const migrationsDir =
    customConfig?.migrationsDir ||
    fileConfig?.migrationsDir ||
    process.env.APPWRITE_MIGRATIONS_DIR ||
    (fs.existsSync(path.resolve(cwd, "database/migrations"))
      ? "./database/migrations"
      : "./migrations");

  const client = customConfig?.client || fileConfig?.client;
  const databases = customConfig?.databases || fileConfig?.databases;

  return {
    endpoint,
    projectId,
    apiKey,
    databaseId,
    migrationsDir,
    client,
    databases,
  };
}
