import type { Actions } from './$types';
import { runWithId } from '$lib/server/db';

function extractZip(from: string | undefined): number | undefined {
  if (!from) return undefined;
  const m = from.match(/\b(\d{5})\b/);
  const digits = m?.[1];
  if (!digits) return undefined;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

// Accepts the same shapes as the client-side loader did and normalizes to array
function normalizeSocial(input: unknown): Array<{ platform?: string; url?: string; label?: string }> | undefined {
  if (input == null) return undefined;
  try {
    // If the input is a string, try to parse JSON first; if parsing fails, treat as plain string
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return undefined;
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeSocial(parsed);
      } catch {
        // Plain string: convert to a single entry
        return isUrlLike(trimmed) ? [{ url: trimmed }] : [{ label: trimmed }];
      }
    }

    if (Array.isArray(input)) {
      const entries = input
        .map((v) => {
          if (typeof v === 'string') {
            return isUrlLike(v) ? { url: v } : { label: v };
          }
          if (v && typeof v === 'object') {
            const obj = v as any;
            const platform = typeof obj.platform === 'string' ? obj.platform : undefined;
            const url = typeof obj.url === 'string' ? obj.url : undefined;
            const label = typeof obj.label === 'string' ? obj.label : undefined;
            if (platform || url || label) return { platform, url, label };
          }
          return undefined;
        })
        .filter(Boolean) as Array<{ platform?: string; url?: string; label?: string }>;
      return entries.length ? entries : undefined;
    }

    if (typeof input === 'object') {
      const entries = Object.entries(input as Record<string, unknown>)
        .map(([platform, url]) => {
          if (typeof url === 'string') return { platform, url };
          return undefined;
        })
        .filter(Boolean) as Array<{ platform?: string; url?: string; label?: string }>;
      return entries.length ? entries : undefined;
    }
  } catch {
    // fall-through
  }
  return undefined;
}

function buildMapUrl(address: string): string {
  const q = encodeURIComponent(address);
  return `https://maps.google.com/?q=${q}`;
}

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();

    const name = String(formData.get('name') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim() || undefined;
    const address = String(formData.get('address') ?? '').trim();
    const offering = String(formData.get('offering') ?? '').trim();
    const availability = String(formData.get('availability') ?? '').trim() || undefined;
    const zipRaw = String(formData.get('zip') ?? '').trim();
    const url = String(formData.get('url') ?? '').trim() || undefined;
    const mapUrlRaw = String(formData.get('mapUrl') ?? '').trim();
    const type = String(formData.get('type') ?? '').trim() || undefined;
    const socialRaw = formData.get('social'); // legacy JSON field (back-compat)

    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Name is required';
    if (!address) errors.address = 'Address is required';
    if (!offering) errors.offering = 'Offering is required';

    // Normalize ZIP: number, exactly 5 digits when present
    const zipFromInput = zipRaw ? extractZip(zipRaw) : undefined;
    const zipNum: number | undefined = zipFromInput ?? extractZip(address);
    if (zipRaw && zipFromInput == null) {
      errors.zip = 'ZIP must be exactly 5 digits';
    }

    let mapUrl = mapUrlRaw || buildMapUrl(address);

    // New structured fields from the form (platform + handle/url)
    const platforms = (formData as any).getAll?.('social_platform') as string[] | undefined;
    const handles = (formData as any).getAll?.('social_handle') as string[] | undefined;

    function buildUrlFrom(platformRaw: string | undefined, handleOrUrlRaw: string | undefined): { platform?: string; url?: string; label?: string } | undefined {
      const platform = platformRaw?.trim().toLowerCase() || undefined;
      const value = handleOrUrlRaw?.trim() || '';
      if (!platform && !value) return undefined;
      if (!value) return undefined;

      // If it's already a URL, keep as-is
      if (isUrlLike(value)) {
        return { platform, url: value };
      }

      // Normalize handle: strip leading @ and leading/trailing slashes and spaces
      let handle = value.replace(/^@+/, '').replace(/^\/+|\/+$/g, '');

      // Build known platform URLs
      switch (platform) {
        case 'facebook':
          return { platform, url: `https://facebook.com/${handle}` };
        case 'instagram':
          return { platform, url: `https://instagram.com/${handle}` };
        case 'twitter':
        case 'x':
          return { platform: 'twitter', url: `https://twitter.com/${handle}` };
        case 'tiktok': {
          // TikTok URLs typically include @ in the path
          const h = handle.startsWith('@') ? handle : `@${handle}`;
          return { platform, url: `https://www.tiktok.com/${h}` };
        }
        case 'linkedin':
          // Default to company profile; users can paste full URL if different
          return { platform, url: `https://www.linkedin.com/company/${handle}` };
        case 'youtube': {
          // Prefer handle-style channel URL
          const h = handle.startsWith('@') ? handle : `@${handle}`;
          return { platform, url: `https://www.youtube.com/${h}` };
        }
        default:
          // Unknown platform: store value as label so it still gets saved
          return { platform, label: value };
      }
    }

    let social = undefined as ReturnType<typeof normalizeSocial>;

    // Prefer new structured fields if provided; otherwise fall back to legacy JSON
    const structured: Array<{ platform?: string; url?: string; label?: string }> = [];
    if (Array.isArray(platforms) || Array.isArray(handles)) {
      const len = Math.max(platforms?.length ?? 0, handles?.length ?? 0);
      for (let i = 0; i < len; i++) {
        const entry = buildUrlFrom(platforms?.[i], handles?.[i]);
        if (entry && (entry.url || entry.label)) structured.push(entry);
      }
    }

    if (structured.length) {
      social = structured;
    } else {
      try {
        social = normalizeSocial(socialRaw as any);
      } catch (e) {
        errors.social = 'Invalid social input';
      }
    }

    if (Object.keys(errors).length) {
      return { success: false, errors };
    }

    const social_json = social && social.length ? JSON.stringify(social) : null;

    try {
      const id = await runWithId(
        `INSERT INTO businesses (name, phone, address, mapUrl, offering, availability, zip, zip_num, url, type, social_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        [name, phone ?? null, address, mapUrl, offering, availability ?? null, null, zipNum ?? null, url ?? null, type ?? null, social_json]
      );

      return { success: true, id };
    } catch (err: any) {
      console.error('Insert failed', err);
      return { success: false, errors: { form: 'Failed to save. Please try again.' } };
    }
  }
};
