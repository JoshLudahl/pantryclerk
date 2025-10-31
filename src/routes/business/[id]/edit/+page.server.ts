import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { get, run } from '$lib/server/db';

function extractZip(from: string | undefined): number | undefined {
  if (!from) return undefined;
  const m = from.match(/\b(\d{5})\b/);
  const digits = m?.[1];
  if (!digits) return undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function normalizeSocial(input: unknown): Array<{ platform?: string; url?: string; label?: string }> | undefined {
  if (input == null) return undefined;
  try {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return undefined;
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeSocial(parsed);
      } catch {
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
  } catch {}
  return undefined;
}

function buildMapUrl(address: string): string {
  const q = encodeURIComponent(address);
  return `https://maps.google.com/?q=${q}`;
}

function buildUrlFrom(platformRaw: string | undefined, handleOrUrlRaw: string | undefined): { platform?: string; url?: string; label?: string } | undefined {
  const platform = platformRaw?.trim().toLowerCase() || undefined;
  const value = handleOrUrlRaw?.trim() || '';
  if (!platform && !value) return undefined;
  if (!value) return undefined;

  if (isUrlLike(value)) {
    return { platform, url: value };
  }

  let handle = value.replace(/^@+/, '').replace(/^\/+|\/+$/g, '');

  switch (platform) {
    case 'facebook':
      return { platform, url: `https://facebook.com/${handle}` };
    case 'instagram':
      return { platform, url: `https://instagram.com/${handle}` };
    case 'twitter':
    case 'x':
      return { platform: 'twitter', url: `https://twitter.com/${handle}` };
    case 'tiktok': {
      const h = handle.startsWith('@') ? handle : `@${handle}`;
      return { platform, url: `https://www.tiktok.com/${h}` };
    }
    case 'linkedin':
      return { platform, url: `https://www.linkedin.com/company/${handle}` };
    case 'youtube': {
      const h = handle.startsWith('@') ? handle : `@${handle}`;
      return { platform, url: `https://www.youtube.com/${h}` };
    }
    default:
      return { platform, label: value };
  }
}

export const load: PageServerLoad = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isFinite(id)) throw error(400, 'Invalid id');

  const row = await get<any>(
    `SELECT id, name, phone, address, mapUrl, offering, availability, zip_num, url, type, social_json FROM businesses WHERE id = ?`,
    [id]
  );
  if (!row) throw error(404, 'Not found');

  let social: Array<{ platform?: string; url?: string; label?: string }> | undefined;
  if (row.social_json) {
    try {
      const parsed = JSON.parse(row.social_json);
      if (Array.isArray(parsed)) social = parsed;
    } catch {}
  }

  const item = {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    address: row.address,
    mapUrl: row.mapUrl || buildMapUrl(row.address),
    offering: row.offering,
    availability: row.availability || '',
    zip: (typeof row.zip_num === 'number' && Number.isFinite(row.zip_num)) ? String(row.zip_num).padStart(5, '0') : (extractZip(row.address)?.toString() ?? ''),
    url: row.url || '',
    type: row.type || '',
    social: social || []
  };

  return { item };
};

export const actions: Actions = {
  update: async ({ request, params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return { success: false, errors: { form: 'Invalid id' } };

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
    const socialRaw = formData.get('social');

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

    const platforms = (formData as any).getAll?.('social_platform') as string[] | undefined;
    const handles = (formData as any).getAll?.('social_handle') as string[] | undefined;

    const structured: Array<{ platform?: string; url?: string; label?: string }> = [];
    if (Array.isArray(platforms) || Array.isArray(handles)) {
      const len = Math.max(platforms?.length ?? 0, handles?.length ?? 0);
      for (let i = 0; i < len; i++) {
        const entry = buildUrlFrom(platforms?.[i], handles?.[i]);
        if (entry && (entry.url || entry.label)) structured.push(entry);
      }
    }

    let social = undefined as ReturnType<typeof normalizeSocial>;
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
      await run(
        `UPDATE businesses
         SET name = ?, phone = ?, address = ?, mapUrl = ?, offering = ?, availability = ?, zip = NULL, zip_num = ?, url = ?, type = ?, social_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
        [name, phone ?? null, address, mapUrl, offering, availability ?? null, zipNum ?? null, url ?? null, type ?? null, social_json, id]
      );
    } catch (err) {
      console.error('Update failed', err);
      return { success: false, errors: { form: 'Failed to update. Please try again.' } };
    }
    throw redirect(303, '/');
  },
  delete: async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return { success: false, errors: { form: 'Invalid id' } };
    try {
      await run(`DELETE FROM businesses WHERE id = ?`, [id]);
    } catch (err) {
      console.error('Delete failed', err);
      return { success: false, errors: { form: 'Failed to delete. Please try again.' } };
    }
    throw redirect(303, '/');
  }
};
