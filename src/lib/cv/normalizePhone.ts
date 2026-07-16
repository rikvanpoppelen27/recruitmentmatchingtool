import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface NormalizedPhone {
  /** E.164 (+31...), of null als normaliseren niet lukte. */
  phone: string | null;
  /** Ruwe tekst uit het CV, alleen gezet als `phone` null is. */
  phoneRaw: string | null;
}

/**
 * Normaliseert een telefoonnummer naar E.164. Standaardlandcode NL (dit is
 * een Nederlandse recruitment-tool), dus "06...", "+31 6...", "0031 6..." en
 * varianten met spaties/streepjes worden allemaal herkend. Lukt normaliseren
 * niet, dan blijft het ruwe nummer bewaard in `phoneRaw` en is `phone` null —
 * er wordt nooit een nummer verzonnen of geraden.
 */
export function normalizePhone(rawPhone: string | null): NormalizedPhone {
  if (!rawPhone || rawPhone.trim().length === 0) {
    return { phone: null, phoneRaw: null };
  }

  const trimmed = rawPhone.trim();
  const parsed = parsePhoneNumberFromString(trimmed, "NL");

  if (parsed && parsed.isValid()) {
    return { phone: parsed.number, phoneRaw: null };
  }

  return { phone: null, phoneRaw: trimmed };
}
