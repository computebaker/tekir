import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';

const USER_AGENT = 'Tekir/1.0 (https://tekir.co/)';

const cache = new Map<string, any>();

// Allowlist of supported language codes to prevent SSRF attacks via lang parameter
const SUPPORTED_LANGUAGES = new Set([
  'en', 'de', 'fr', 'it', 'es', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi', 'pl', 
  'nl', 'sv', 'no', 'da', 'fi', 'cs', 'hu', 'ro', 'tr', 'el', 'he', 'uk', 'vi', 'th'
]);

function validateLanguage(lang: string | null): string {
  // Default to 'en' if lang is not provided or invalid
  const normalized = String(lang || 'en').toLowerCase().trim();
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : 'en';
}

async function fetchJson(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
  return res.json();
}

async function getSummary(title: string, lang = 'en') {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  return fetchJson(url);
}

async function getQidFromTitle(title: string, lang = 'en') {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageprops&format=json&origin=*`;
  const j = await fetchJson(url);
  const pages = j.query?.pages;
  const page = pages && j.query.pages[Object.keys(pages)[0]];
  return page?.pageprops?.wikibase_item || null;
}

async function getWikidataEntity(qid: string) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  return fetchJson(url);
}

function pickBestClaim(claims: any[] = []) {
  if (!claims || claims.length === 0) return null;
  const preferred = claims.find((c) => c.rank === 'preferred');
  if (preferred) return preferred;
  const withP585 = claims
    .map((c) => {
      const q = c.qualifiers?.P585;
      const t = q?.[0]?.datavalue?.value?.time ? new Date(q[0].datavalue.value.time) : null;
      return { claim: c, time: t };
    })
    .filter((x) => x.time)
    .sort((a, b) => (b.time as any) - (a.time as any));
  if (withP585.length) return withP585[0].claim;
  return claims[0];
}

function quantityAmountFromClaim(claim: any) {
  try {
    const main = claim.mainsnak.datavalue.value;
    const amountStr = main.amount ?? main['amount'];
    if (amountStr) return Number(amountStr);
    if (typeof main === 'number') return main;
    return null;
  } catch {
    return null;
  }
}

function extractStringFromClaim(claim: any) {
  try {
    const v = claim.mainsnak.datavalue.value;
    if (typeof v === 'string') return v;
    if (v?.id) return v.id; // QID
    if (v?.time) return v.time;
    if (v?.amount) return v.amount;
    return String(v);
  } catch {
    return null;
  }
}

async function resolveLabelsForQids(qids: string[] = [], lang = 'en') {
  if (!qids || qids.length === 0) return {};
  const unique = Array.from(new Set(qids));
  const out: Record<string, string> = {};
  const chunkSize = 50; // wbgetentities supports many but keep conservative to avoid long URLs
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&format=json&props=labels&languages=${lang}|en`;
    const j = await fetchJson(url).catch(() => null);
    if (!j || !j.entities) {
      // fallback: mark chunk ids as themselves
      for (const id of chunk) out[id] = id;
      continue;
    }
    for (const id of chunk) {
      out[id] = j.entities?.[id]?.labels?.[lang]?.value || j.entities?.[id]?.labels?.en?.value || id;
    }
    // small delay to be polite (avoid hammering)
    await new Promise((r) => setTimeout(r, 50));
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(req, '/api/wikidata');
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    const url = new URL(req.url);
    const title = String(url.searchParams.get('title') || url.searchParams.get('q') || '');
    const lang = validateLanguage(url.searchParams.get('lang'));
    if (!title) return NextResponse.json({ error: 'missing title' }, { status: 400 });

    const summary = await getSummary(title, lang).catch(() => null);
    const qid = await getQidFromTitle(title, lang).catch(() => null);
    const facts: any = {};

    if (qid) {
      const wd = await getWikidataEntity(qid).catch(() => null);
      const claims = wd?.entities?.[qid]?.claims || {};
      // collect every QID present in any claim so we can resolve labels comprehensively
      const qidSet = new Set<string>();
      for (const propKey of Object.keys(claims || {})) {
        const arr = claims[propKey];
        if (!Array.isArray(arr)) continue;
        for (const c of arr) {
          const id = c?.mainsnak?.datavalue?.value?.id;
          if (id) qidSet.add(id);
          // also check qualifiers for QIDs
          if (c?.qualifiers) {
            for (const qk of Object.keys(c.qualifiers)) {
              for (const qv of c.qualifiers[qk]) {
                const qid = qv?.datavalue?.value?.id;
                if (qid) qidSet.add(qid);
              }
            }
          }
        }
      }

      // resolve labels for all collected QIDs in one call
      const qidsToResolve = Array.from(qidSet);
      const resolvedLabels = qidsToResolve.length ? (await resolveLabelsForQids(qidsToResolve, lang).catch(() => ({} as Record<string,string>))) : {} as Record<string,string>;

      // basic numeric and date facts
      if (claims.P1082) {
        const c = pickBestClaim(claims.P1082);
        facts.population = quantityAmountFromClaim(c);
      }
      if (claims.P2046) {
        const c = pickBestClaim(claims.P2046);
        facts.area_m2 = quantityAmountFromClaim(c);
      }
      if (claims.P1128) {
        const c = pickBestClaim(claims.P1128);
        facts.number_of_employees = quantityAmountFromClaim(c);
      }
      if (claims.P2047) {
        const c = pickBestClaim(claims.P2047);
        facts.number_of_pages = quantityAmountFromClaim(c);
      }

      // postal / phone
      if (claims.P281) facts.postal_codes = claims.P281.map(extractStringFromClaim).filter(Boolean);
      if (claims.P473) facts.local_dialing_codes = claims.P473.map(extractStringFromClaim).filter(Boolean);
      if (claims.P474) facts.country_calling_codes = claims.P474.map(extractStringFromClaim).filter(Boolean);

      // coordinates
      if (claims.P625 && claims.P625[0]?.mainsnak?.datavalue) {
        const v = claims.P625[0].mainsnak.datavalue.value;
        facts.coordinates = { lat: v.latitude, lon: v.longitude };
      }

      // helper: normalize Wikidata time strings like +1951-00-00T00:00:00Z
      const normalizeWikidataTime = (timeStr: string | undefined | null) => {
        if (!timeStr) return null;
        // strip leading + if present
        const s = String(timeStr).trim().replace(/^\+/, '');
        // match YYYY or YYYY-MM or YYYY-MM-DD (month/day may be 00)
        const m = s.match(/^([+-]?\d{1,})(?:-(\d{2})-(\d{2}))?/);
        if (!m) return s;
        const year = m[1];
        const month = m[2];
        const day = m[3];
        if (month && month !== '00') {
          if (day && day !== '00') return `${year}-${month}-${day}`;
          return `${year}-${month}`;
        }
        return `${year}`;
      };

      // Only keep publication date (P577). Normalize format to YYYY, YYYY-MM or YYYY-MM-DD
      if (claims.P577) {
        const c = pickBestClaim(claims.P577);
        const t = c?.mainsnak?.datavalue?.value?.time;
        const norm = normalizeWikidataTime(t);
        if (norm) facts.publication_date = norm;
      }

  // string-like single claims
  if (claims.P856) facts.official_website = claims.P856.map(extractStringFromClaim).filter(Boolean);
  // remove images (P18) and logo (P154) from facts to keep facts compact

      // map QID-based props to {id,label}
      const normalizeLabel = (s: string) => {
        return String(s || '')
          .replace(/\s*\(.*?\)\s*/g, ' ') // remove parentheses
          .replace(/["'`·••]/g, '')
          .replace(/[^\w\s-]/g, ' ') // remove punctuation
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      };

      const mapQList = (prop: string) => {
        if (!claims[prop]) return undefined;
        // Build candidate objects with metadata
        const candidates: Array<{ id?: string; label: string; rank?: string; time?: string | null; originalIndex: number; raw: any }> = [];
        for (let i = 0; i < claims[prop].length; i++) {
          const c = claims[prop][i];
          const id = c.mainsnak?.datavalue?.value?.id;
          const label = id ? (resolvedLabels[id] || id) : String(extractStringFromClaim(c) || '');
          const rank = c.rank;
          const time = c.qualifiers?.P585?.[0]?.datavalue?.value?.time || null;
          candidates.push({ id, label, rank, time, originalIndex: i, raw: c });
        }

        // Group by normalized label
        const groups = new Map<string, Array<typeof candidates[0]>>();
        const order: string[] = [];
        for (const cand of candidates) {
          const key = normalizeLabel(cand.label) || (cand.id || '');
          if (!groups.has(key)) {
            groups.set(key, []);
            order.push(key);
          }
          groups.get(key)!.push(cand);
        }

        // Heuristic to pick best candidate per group
        const pickBest = (arr: Array<typeof candidates[0]>) => {
          if (arr.length === 1) return arr[0];
          // 1) prefer rank === 'preferred'
          const preferred = arr.find(a => a.rank === 'preferred');
          if (preferred) return preferred;
          // 2) prefer most recent P585
          const withTime = arr.filter(a => a.time).sort((a, b) => (new Date(b.time as string).getTime() - new Date(a.time as string).getTime()));
          if (withTime.length) return withTime[0];
          // 3) prefer one whose label matches exactly when trimmed
          const exact = arr.find(a => a.label && a.label.toLowerCase().trim() === arr[0].label.toLowerCase().trim());
          if (exact) return exact;
          // 4) fallback to earliest originalIndex
          return arr.slice().sort((a,b) => a.originalIndex - b.originalIndex)[0];
        };

        const out: any[] = [];
        for (const key of order) {
          const group = groups.get(key)!;
          const best = pickBest(group);
          if (!best) continue;
            if (best.id) out.push({ id: best.id, label: best.label, wikidataUrl: `https://www.wikidata.org/wiki/${best.id}` });
          else if (best.label) out.push(best.label);
        }

        return out.length ? out : undefined;
      };

  // apply mappings for item-like props (omit P31 instance_of per request)
  facts.place_of_birth = mapQList('P19');
  facts.place_of_death = mapQList('P20');
  facts.country_of_citizenship = mapQList('P27');
  facts.occupation = mapQList('P106');
  facts.positions_held = mapQList('P39');
  facts.family_name = mapQList('P734');
  facts.notable_works = mapQList('P800');
  facts.authors = mapQList('P50');
      facts.employer = mapQList('P108');
      facts.languages_spoken = mapQList('P1412');
      facts.country = mapQList('P17');
      facts.capital = mapQList('P36');
      facts.administrative_divisions = mapQList('P150');
      facts.neighborhoods = mapQList('P1383');
      facts.founders = mapQList('P112');
      facts.headquarters = mapQList('P159');
      facts.parent_organization = mapQList('P749');
      facts.developer = mapQList('P178');
      facts.manufacturer = mapQList('P176');
      facts.license = mapQList('P275');
      facts.operating_system = mapQList('P306');
      facts.repository = mapQList('P1324');
      facts.creator = mapQList('P170');
      facts.publisher = mapQList('P123');
      facts.genre = mapQList('P136');
      facts.programming_languages = mapQList('P277') || undefined;
      facts.product = mapQList('P1056');
      facts.industry = mapQList('P452');
      facts.owned_by = mapQList('P127');
      facts.notable_works = facts.notable_works || mapQList('P800');
      facts.time_zone = mapQList('P421');

      // financials
      if (claims.P2139) {
        const c = pickBestClaim(claims.P2139);
        facts.revenue = quantityAmountFromClaim(c);
      }
      if (claims.P2130) {
        const c = pickBestClaim(claims.P2130);
        facts.operating_income = quantityAmountFromClaim(c);
      }

      // other simple mappings
      if (claims.P212) facts.isbn = claims.P212.map(extractStringFromClaim).filter(Boolean);
    }

    const out = {
      title: (summary?.displaytitle || title),
      summary: summary?.extract || null,
      wiki_summary_url: summary?.content_urls?.desktop?.page ?? (qid ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` : null),
      qid: qid || null,
      facts,
    };

    return NextResponse.json(out);
  } catch (err) {
    console.error('wikidata route error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
