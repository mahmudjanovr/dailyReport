const CYRILLIC_TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '',
  ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/**
 * Normalizes a category label into a clean, stable ASCII key.
 * Supports Uzbek Latin & Cyrillic characters, accents, and apostrophe variants.
 *
 * Example:
 * "Qayta qo‘ng‘iroq qilish" -> "qayta_qongiroq_qilish"
 * "Farzandlari katta" -> "farzandlari_katta"
 * "Farzandi yo‘q" -> "farzandi_yoq"
 * "Noto‘g‘ri raqam" -> "notogri_raqam"
 *
 * @param {string} label
 * @returns {string}
 */
export function normalizeCategoryKey(label) {
  if (!label || typeof label !== 'string') {
    return '';
  }

  let text = label.trim().toLowerCase();

  // 1. Transliterate Uzbek Cyrillic if present
  text = text
    .split('')
    .map((ch) => CYRILLIC_TO_LATIN[ch] || ch)
    .join('');

  // 2. Remove Uzbek apostrophes / modifier letters so e.g. "qo‘ng‘iroq" -> "qongiroq"
  text = text.replace(/[\u02BB\u02BC\u2018\u2019\u0027\u0060\u00B4"“”«»]/g, '');

  // 3. Decompose and remove unicode diacritics
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 4. Replace any non-alphanumeric characters with underscores
  text = text.replace(/[^a-z0-9]+/g, '_');

  // 5. Collapse consecutive underscores and trim from boundaries
  text = text.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  return text;
}
