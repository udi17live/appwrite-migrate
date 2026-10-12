import { MigrationMetadata } from "./types";

export function generateTemplate(metadata: MigrationMetadata): string {
  return `import { Databases, ID } from "node-appwrite";
import { Migration } from "appwrite-migrate";

export const migration: Migration = {
  metadata: {
    versionId: "${metadata.versionId}",
    previousVersionId: ${metadata.previousVersionId ? `"${metadata.previousVersionId}"` : "null"},
    name: "${metadata.name}",
    author: "${metadata.author}",
    createdAt: "${metadata.createdAt}"
  },

  up: async (databases: Databases, dbId: string) => {
    // Write your upgrade logic here
  },

  down: async (databases: Databases, dbId: string) => {
    // Write your downgrade/rollback logic here
  }
};
`;
}
