import fs from 'node:fs/promises';
import path from 'node:path';
import pdf from 'pdf-parse';

function extractZip(address) {
  if (!address) return undefined;
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : undefined;
}
function isPhoneLine(s) {
  return /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(s);
}
function extractPhone(s) {
  const m = s.match(/\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  return m ? m[0] : undefined;
}
function extractUrl(s) {
  const m = s.match(/\bhttps?:\/\/\S+/i);
  return m ? m[0] : undefined;
}
function makeMapUrl(address) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

function looksLikeSectionHeader(line) {
  if (!line) return false;
  const isShort = line.length <= 80;
  const hasNoComma = !line.includes(',');
  const hasLetters = /[A-Za-z]/.test(line);
  const likelyHeader = /^[A-Za-z0-9 &/’'–—-]+$/.test(line);
  // Avoid lines that look like addresses or phone numbers
  const looksLikeAddress = /(St|Ave|Rd|Blvd|Dr|Way|Ln|Hwy|Ct|Cir|Pl|Terr|Pkwy|Street|Avenue)\b/i.test(line) || /\d{3,}/.test(line);
  return isShort && hasNoComma && hasLetters && likelyHeader && !looksLikeAddress;
}

function normalizeWhitespace(s) {
  return s?.replace(/\s+/g, ' ').trim() || undefined;
}

// Parse blocks assuming a row looks like:
// Name
// Offering (can span lines)...
// Address line
// Availability line (optional)
// Phone/Website (optional)
// Blank line between entries.
// Section headers update currentType until next header.
function parseBusinessesFromText(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((l) => l.replace(/\u00a0/g, ' ').trim());
  let currentType = undefined;
  const items = [];
  let buf = [];

  const flushBuffer = () => {
    const block = buf.filter(Boolean);
    buf = [];
    if (block.length === 0) return;

    const name = block[0];
    if (!name) return;

    // Find first address-like line
    let addressIdx = -1;
    for (let i = 1; i < block.length; i++) {
      const l = block[i];
      const looksAddress = /\d{1,6}\s+\S+/.test(l) && /(St|Ave|Rd|Blvd|Dr|Way|Ln|Hwy|Ct|Cir|Pl|Terr|Pkwy|Street|Avenue|Highway|Road|Lane|Court|Place|Drive)\b/i.test(l);
      const hasCityStateZip = /(,\s*[A-Z]{2}\s*\d{5}(-\d{4})?\b)/.test(l);
      if (looksAddress || hasCityStateZip) {
        addressIdx = i;
        break;
      }
    }
    if (addressIdx === -1 && block.length > 1) {
      // fallback: choose the last line with a state/ZIP hint
      addressIdx = block.findIndex((l) => /\b(OR|WA|CA|ID)\b/i.test(l) || /\b\d{5}\b/.test(l));
    }
    if (addressIdx === -1) return; // cannot parse reliably

    const offeringLines = block.slice(1, addressIdx);
    const address = block[addressIdx];

    // Availability: take the next line after address unless it is clearly phone/URL or empty
    let availability;
    let cursor = addressIdx + 1;
    if (cursor < block.length) {
      const line = block[cursor];
      if (line && !isPhoneLine(line) && !/^https?:\/\//i.test(line)) {
        availability = line;
        cursor++;
      }
    }

    // Scan remaining lines for phone and url
    let phone;
    let url;
    for (; cursor < block.length; cursor++) {
      const line = block[cursor];
      if (!phone && isPhoneLine(line)) phone = extractPhone(line);
      if (!url) {
        const u = extractUrl(line);
        if (u) url = u;
      }
    }

    const item = {
      name: normalizeWhitespace(name),
      offering: normalizeWhitespace(offeringLines.join(' ')),
      address: normalizeWhitespace(address),
      availability: normalizeWhitespace(availability),
      phone: phone ? normalizeWhitespace(phone) : undefined,
      url: url ? normalizeWhitespace(url) : undefined,
      zip: extractZip(address),
      mapUrl: makeMapUrl(address),
      type: currentType ? normalizeWhitespace(currentType) : undefined
    };

    if (item.name && item.address && item.offering && item.mapUrl) {
      items.push(item);
    }
  };

  for (const line of lines) {
    if (!line) {
      flushBuffer();
      continue;
    }
    if (looksLikeSectionHeader(line)) {
      flushBuffer();
      currentType = line;
      continue;
    }
    buf.push(line);
  }
  flushBuffer();

  // Deduplicate by name+address
  const seen = new Set();
  const unique = [];
  for (const it of items) {
    const key = `${it.name}|${it.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(it);
    }
  }
  return unique;
}

async function main() {
  const pdfPath = process.argv[2] || 'Food Resource List - PDX.pdf';
  const outPath = path.join('static', 'data', 'businesses-import.json');

  const buffer = await fs.readFile(pdfPath);
  const data = await pdf(buffer);
  const items = parseBusinessesFromText(data.text);

  // Basic validation/warnings
  const problems = [];
  for (const [i, b] of items.entries()) {
    if (!b.zip) problems.push(`Item ${i + 1} "${b.name}": ZIP not detected from address "${b.address}"`);
  }
  if (problems.length) {
    console.warn('Warnings during import:');
    for (const p of problems) console.warn(' -', p);
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`Wrote ${items.length} businesses to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
