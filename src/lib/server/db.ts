import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

// Singleton connection for the server environment
const dataDir = path.resolve('var', 'data');
const dbPath = path.join(dataDir, 'pantryclerk.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath);

// Promisified helpers
export function run(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function runWithId(sql: string, params: any[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve((this as unknown as { lastID: number }).lastID);
    });
  });
}

export function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row as T | undefined);
    });
  });
}

export function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows as T[]);
    });
  });
}

// Ensure basic pragmas each time the module is loaded
run('PRAGMA foreign_keys = ON').catch(() => {});
run('PRAGMA journal_mode = WAL').catch(() => {});

// Light auto-migration: create table/indexes if not present (mirrors scripts/migrate.mjs)
(async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT NOT NULL,
      mapUrl TEXT,
      offering TEXT NOT NULL,
      availability TEXT,
      zip TEXT,
      url TEXT,
      type TEXT,
      social_json TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(name, address) ON CONFLICT IGNORE
    );
  `);
  // Add numeric ZIP column if missing
  try { await run(`ALTER TABLE businesses ADD COLUMN zip_num INTEGER`); } catch {}
  await run(`CREATE INDEX IF NOT EXISTS idx_businesses_zip ON businesses(zip);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_businesses_zip_num ON businesses(zip_num);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(type);`);
})();

export type SocialEntry = { platform?: string; url?: string; label?: string };
export type NewBusiness = {
  name: string;
  phone?: string;
  address: string;
  mapUrl?: string;
  offering: string;
  availability?: string;
  zip?: string;
  url?: string;
  type?: string;
  social?: SocialEntry[];
};
