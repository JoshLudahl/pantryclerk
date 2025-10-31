#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const dataDir = path.resolve('var', 'data');
const dbPath = path.join(dataDir, 'pantryclerk.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

(async () => {
  try {
    await run('PRAGMA foreign_keys = ON');
    await run('PRAGMA journal_mode = WAL');

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
    try { await run(`ALTER TABLE businesses ADD COLUMN zip_num INTEGER`); } catch (_) {}
    // Indexes
    await run(`CREATE INDEX IF NOT EXISTS idx_businesses_zip ON businesses(zip);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_businesses_zip_num ON businesses(zip_num);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(type);`);

    // Backfill zip_num from existing data where null
    try {
      await run(`UPDATE businesses SET zip_num = CAST(substr(zip,1,5) AS INTEGER) WHERE zip_num IS NULL AND zip GLOB '[0-9][0-9][0-9][0-9][0-9]*'`);
      await run(`UPDATE businesses SET zip_num = CAST((CASE WHEN address GLOB '*[0-9][0-9][0-9][0-9][0-9]*' THEN substr(address, INSTR(address, substr(address, LENGTH(address)-9, 10)), 5) ELSE NULL END) AS INTEGER) WHERE zip_num IS NULL`);
    } catch (_) {}

    console.log(`Migration complete. DB at: ${dbPath}`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
