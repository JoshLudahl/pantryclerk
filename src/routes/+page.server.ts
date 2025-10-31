import type { PageServerLoad } from './$types';
import { all } from '$lib/server/db';

export type SocialEntry = { platform?: string; url?: string; label?: string };
export type Business = {
  id: number;
  name: string;
  phone?: string;
  address: string;
  mapUrl: string;
  offering: string;
  availability?: string;
  zip?: number;
  url?: string;
  social?: SocialEntry[];
  type?: string;
};

function extractZip(from: string | undefined): number | undefined {
  if (!from) return undefined;
  const m = from.match(/\b(\d{5})\b/);
  const digits = m?.[1];
  if (!digits) return undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

export const load: PageServerLoad = async () => {
  const rows = await all<any>(
    `SELECT id, name, phone, address, mapUrl, offering, availability, zip_num, url, type, social_json FROM businesses`
  );

  const items: Business[] = rows.map((r) => {
    let social: SocialEntry[] | undefined = undefined;
    if (r.social_json) {
      try {
        const parsed = JSON.parse(r.social_json);
        if (Array.isArray(parsed)) social = parsed as SocialEntry[];
      } catch {
        // ignore bad JSON in DB
      }
    }
    const zipNum: number | undefined = (typeof r.zip_num === 'number' && Number.isFinite(r.zip_num)) ? r.zip_num : extractZip(r.address);
    return {
      id: r.id,
      name: r.name,
      phone: r.phone || undefined,
      address: r.address,
      mapUrl: r.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(r.address)}`,
      offering: r.offering,
      availability: r.availability || undefined,
      zip: zipNum,
      url: r.url || undefined,
      social,
      type: r.type || undefined
    } satisfies Business;
  });

  return { items };
};
