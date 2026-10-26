/** Latin script (with any diacritics, so Vietnamese counts), digits, punctuation and spaces. */
const LATIN = /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{S}\s]*$/u;
export const isLatin = (s: string | undefined | null): s is string => !!s && LATIN.test(s);

/**
 * Vietnamese country names → English + ISO code, so "Bangkok thái lan" means Bangkok in Thailand
 * (search services don't know "thái lan"; Photon would match "Soi Lan Na Thai" instead). Short
 * names that also occur in Vietnamese place names (Phước Mỹ, Lào Cai, Đức Trọng…) only count
 * with "nước" in front.
 */
const COUNTRIES: [vi: string, en: string, iso: string][] = [
  ['thái lan', 'Thailand', 'TH'],
  ['nhật bản', 'Japan', 'JP'],
  ['nước nhật', 'Japan', 'JP'],
  ['hàn quốc', 'South Korea', 'KR'],
  ['trung quốc', 'China', 'CN'],
  ['nước lào', 'Laos', 'LA'],
  ['campuchia', 'Cambodia', 'KH'],
  ['cam pu chia', 'Cambodia', 'KH'],
  ['mã lai', 'Malaysia', 'MY'],
  ['đài loan', 'Taiwan', 'TW'],
  ['hồng kông', 'Hong Kong', 'HK'],
  ['ấn độ', 'India', 'IN'],
  ['nước pháp', 'France', 'FR'],
  ['pháp', 'France', 'FR'],
  ['nước đức', 'Germany', 'DE'],
  ['nước ý', 'Italy', 'IT'],
  ['tây ban nha', 'Spain', 'ES'],
  ['bồ đào nha', 'Portugal', 'PT'],
  ['nước anh', 'United Kingdom', 'GB'],
  ['anh quốc', 'United Kingdom', 'GB'],
  ['nước mỹ', 'United States', 'US'],
  ['hoa kỳ', 'United States', 'US'],
  ['nước úc', 'Australia', 'AU'],
  ['nước nga', 'Russia', 'RU'],
  ['thụy sĩ', 'Switzerland', 'CH'],
  ['hà lan', 'Netherlands', 'NL'],
  ['phi-líp-pin', 'Philippines', 'PH'],
];

export interface ParsedQuery {
  /** The place part, without a trailing country ("Bangkok"). */
  place: string;
  /** English country name and ISO code when the query ended with a Vietnamese country name. */
  country: { en: string; iso: string } | null;
}

/** Split "Bangkok thái lan" into place "Bangkok" + country Thailand/TH. */
export function parseQuery(text: string): ParsedQuery {
  const query = text.normalize('NFC').trim();
  const lower = query.toLocaleLowerCase('vi');
  for (const [vi, en, iso] of COUNTRIES) {
    if (lower.endsWith(` ${vi}`) && lower.length > vi.length + 1) {
      return { place: query.slice(0, query.length - vi.length).trimEnd(), country: { en, iso } };
    }
  }
  return { place: query, country: null };
}

/** The query as a free-text search engine should see it: "Bangkok thái lan" → "Bangkok Thailand". */
export function translateCountry(text: string): string {
  const { place, country } = parseQuery(text);
  return country ? `${place} ${country.en}` : place;
}
