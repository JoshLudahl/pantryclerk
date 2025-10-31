#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const dataDir = path.resolve('var', 'data');
const dbPath = path.join(dataDir, 'pantryclerk.db');
const jsonPath = path.resolve('static', 'data', 'businesses.json');

function extractZip(from) {
  if (!from) return undefined;
  const m = String(from).match(/\b(\d{5})(?:-\d{4})?\b/);
  return m?.[1];
}

function isUrlLike(s) {
  return /^https?:\/\//i.test(String(s));
}

function buildMapUrl(address) {
  const q = encodeURIComponent(address);
  return `https://maps.google.com/?q=${q}`;
}

function normalizeSocial(s) {
  if (!s) return undefined;
  if (Array.isArray(s)) {
    const entries = s
      .map((v) => {
        if (typeof v === 'string') {
          return isUrlLike(v) ? { url: v } : { label: v };
        }
        if (v && typeof v === 'object') {
          const obj = v;
          const platform = typeof obj.platform === 'string' ? obj.platform : undefined;
          const url = typeof obj.url === 'string' ? obj.url : undefined;
          const label = typeof obj.label === 'string' ? obj.label : undefined;
          if (platform || url || label) return { platform, url, label };
        }
        return undefined;
      })
      .filter(Boolean);
    return entries.length ? entries : undefined;
  }
  if (typeof s === 'object') {
    const entries = Object.entries(s)
      .map(([platform, url]) => (typeof url === 'string' ? { platform, url } : undefined))
      .filter(Boolean);
    return entries.length ? entries : undefined;
  }
  return undefined;
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(jsonPath)) {
    console.error(`Seed file not found: ${jsonPath}`);
    process.exit(1);
  }

  /** @type {Array<any>} */
  let raw;
  try {
    const txt = fs.readFileSync(jsonPath, 'utf8');
    raw = JSON.parse(txt);
    if (!Array.isArray(raw)) throw new Error('Root JSON is not an array');
  } catch (err) {
    console.error('Failed to read/parse businesses.json:', err);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);
  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });
  }
  function runWithId(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  }
  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  try {
    await run('PRAGMA foreign_keys = ON');
    await run('PRAGMA journal_mode = WAL');

    // Ensure table exists (in case migrate wasn't run yet)
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

    // Ensure numeric ZIP column exists and is indexed
    try { await run(`ALTER TABLE businesses ADD COLUMN zip_num INTEGER`); } catch {}
    await run(`CREATE INDEX IF NOT EXISTS idx_businesses_zip ON businesses(zip);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_businesses_zip_num ON businesses(zip_num);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(type);`);

    let inserted = 0;
    let skipped = 0;

    for (const b of raw) {
      const name = String(b.name ?? '').trim();
      const phone = b.phone ? String(b.phone).trim() : null;
      const address = String(b.address ?? '').trim();
      const offering = String(b.offering ?? '').trim();
      const availability = b.availability ? String(b.availability).trim() : null;
      const type = b.type ? String(b.type).trim() : null;
      const url = b.url ? String(b.url).trim() : null;
      const zipNum = (b.zip ? extractZip(String(b.zip).trim()) : extractZip(address)) || null;
      const mapUrl = (b.mapUrl ? String(b.mapUrl).trim() : buildMapUrl(address)) || null;
      const social = normalizeSocial(b.social);
      const social_json = social && social.length ? JSON.stringify(social) : null;

      if (!name || !address || !offering) {
        skipped++;
        continue;
      }

      try {
        await runWithId(
          `INSERT INTO businesses (name, phone, address, mapUrl, offering, availability, zip, zip_num, url, type, social_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
          [name, phone, address, mapUrl, offering, availability, zipNum, url, type, social_json]
        );
        inserted++;
      } catch (err) {
        if (String(err.message || '').includes('UNIQUE')) {
          skipped++;
        } else {
          console.error('Insert error for', name, '-', err);
          skipped++;
        }
      }
    }

    const countRow = await get('SELECT COUNT(*) AS c FROM businesses');
    console.log(`Seed complete: inserted ${inserted}, skipped ${skipped}. Total rows: ${countRow?.c ?? 'unknown'}`);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
