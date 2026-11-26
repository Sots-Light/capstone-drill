import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
const defaultDatabasePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/capstone.sqlite",
);

export function openDatabase(filename = defaultDatabasePath) {
  const databasePath = filename === ":memory:" ? filename : resolve(filename);
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(readFileSync(schemaPath, "utf8"));
  return database;
}

export { defaultDatabasePath };
