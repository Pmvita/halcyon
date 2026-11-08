function luhnCheckDigit(body: string): string {
  let sum = 0;
  for (let i = body.length - 1, alt = true; i >= 0; i -= 1, alt = !alt) {
    let digit = Number(body[i]);
    if (alt) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
}

export function luhnValid(pan: string): boolean {
  const digits = pan.replace(/\D/g, "");
  if (digits.length < 13) return false;
  const body = digits.slice(0, -1);
  return luhnCheckDigit(body) === digits.slice(-1);
}

/** 16-digit PANs beginning with 9999. The prefix is not a real issuer BIN. */
export function demoPan(seed: string): string {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  let body = "9999";
  for (let i = 0; i < 11; i += 1) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    body += String(hash % 10);
  }
  return body + luhnCheckDigit(body);
}

export function formatPan(pan: string): string {
  return pan.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function sanitizeName(value: string): string {
  return value.replace(/[<>&"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
