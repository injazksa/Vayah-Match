// فلتر ذكي للأرقام والسوشال ميديا والروابط - Anti-Leakage System

const PHONE_PATTERNS = [
  // أرقام بصيغ مختلفة (غربي)
  /\+?\d[\d\s\-\(\)\.]{7,}\d/g,
  // أرقام عربية
  /[\u0660-\u0669][\u0660-\u0669\s\-]{7,}[\u0660-\u0669]/g,
];

const SOCIAL_PATTERNS = [
  /(snap(?:chat)?|سناب|sc)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(insta(?:gram)?|انستغرام|إنستا|ig)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(facebook|fb|فيسبوك|فيس)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(telegram|tg|تلغرام|تليجرام)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(whats(?:app)?|wa|واتس|واتساب)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(tiktok|tt|تيكتوك)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(twitter|x\.com|تويتر|إكس)[\s:@.\-_]*[a-z0-9_.\-]{2,}/gi,
  /(discord|ديسكورد)[\s:@.\-_]*[a-z0-9_.\-#]{2,}/gi,
  /(youtube|yt|يوتيوب)[\s:@.\-_/]*[a-z0-9_.\-]{2,}/gi,
  // @username عام
  /@[a-z0-9_.]{3,}/gi,
];

const URL_PATTERNS = [
  /https?:\/\/[^\s،]+/gi,
  /www\.[a-z0-9-]+\.[a-z]{2,}[^\s،]*/gi,
  /[a-z0-9-]+\.(com|net|org|io|me|co|app|gg|tv|live|to|cc)(?!\w)[a-z0-9\/\?=#&_-]*/gi,
];

const CONTACT_KEYWORDS = [
  // أرقام بحروف (تحايل)
  /(صفر|واحد|اثنين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)[\s\u060c]+(صفر|واحد|اثنين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)/gi,
  // إيميل
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
];

const ALL_PATTERNS = [...PHONE_PATTERNS, ...SOCIAL_PATTERNS, ...URL_PATTERNS, ...CONTACT_KEYWORDS];

/**
 * فحص النص وتنظيفه من عناصر التسريب.
 * @returns { clean: string, blocked: string[], hasViolation: boolean }
 */
export function filterLeaks(text) {
  if (!text || typeof text !== 'string') return { clean: text, blocked: [], hasViolation: false };
  let clean = text;
  const blocked = new Set();
  for (const pattern of ALL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length) {
      matches.forEach(m => blocked.add(m.trim()));
      clean = clean.replace(pattern, '【⌖ محتوى محجوب】');
    }
  }
  return { clean, blocked: Array.from(blocked), hasViolation: blocked.size > 0 };
}

export function severity(count) {
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}
