import "dotenv/config";
import { defineConfig } from "appwrite-migrate";

export default defineConfig({
  /**
   * Appwrite instance endpoint URL.
   * Defaults to process.env.APPWRITE_ENDPOINT or process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
   */
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",

  /**
   * Appwrite Project ID.
   * Defaults to process.env.APPWRITE_PROJECT_ID or process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
   */
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",

  /**
   * Appwrite Server API Key (Requires database and collection read/write scope).
   * Defaults to process.env.APPWRITE_API_KEY
   */
  apiKey: process.env.APPWRITE_API_KEY || "",

  /**
   * Target Database ID.
   * If omitted or left empty, appwrite-migrate will automatically target the first database.
   */
  databaseId: process.env.APPWRITE_DATABASE_ID || "",

  /**
   * Path to the folder containing your migration files.
   * Defaults to "./database/migrations"
   */
  migrationsDir: "./database/migrations",

  /**
   * (Optional) Custom Databases or Client instance.
   * Useful for legacy self-hosted Appwrite instances or custom client setups.
   * databases: new Databases(customClient),
   */
});
