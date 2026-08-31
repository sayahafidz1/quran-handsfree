const BASIC_NUMBERS: Record<string, number> = {
  nol: 0,
  kosong: 0,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  seratus: 100,
  seribu: 1000
};

export function parseNumberString(text: string): number | null {
  if (!text || !text.trim()) return null;

  const clean = text
    .toLowerCase()
    .replace(/^ke-?/, "")
    .replace(/[^\w\s]/g, " ")
    .trim();

  // If it's pure digits
  const digitMatch = clean.match(/^\d+$/);
  if (digitMatch) {
    const val = parseInt(digitMatch[0], 10);
    return isNaN(val) ? null : val;
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Check if every token is part of Indonesian number grammar or digits
  let total = 0;
  let currentGroup = 0;
  let lastUnit = 0;
  let hasNumberToken = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // If token is a raw number (e.g. "200" or "55")
    if (/^\d+$/.test(token)) {
      const num = parseInt(token, 10);
      currentGroup += num;
      hasNumberToken = true;
      lastUnit = num;
      continue;
    }

    if (token === "seratus") {
      currentGroup += 100;
      hasNumberToken = true;
      lastUnit = 100;
      continue;
    }

    if (token === "sepuluh") {
      currentGroup += 10;
      hasNumberToken = true;
      lastUnit = 10;
      continue;
    }

    if (token === "sebelas") {
      currentGroup += 11;
      hasNumberToken = true;
      lastUnit = 11;
      continue;
    }

    if (token === "seribu") {
      total += (currentGroup === 0 ? 1 : currentGroup) * 1000;
      currentGroup = 0;
      hasNumberToken = true;
      lastUnit = 1000;
      continue;
    }

    if (token === "ratus") {
      if (lastUnit > 0) {
        currentGroup = currentGroup - lastUnit + lastUnit * 100;
      } else {
        currentGroup += 100;
      }
      hasNumberToken = true;
      lastUnit = 0;
      continue;
    }

    if (token === "puluh") {
      if (lastUnit > 0) {
        currentGroup = currentGroup - lastUnit + lastUnit * 10;
      } else {
        currentGroup += 10;
      }
      hasNumberToken = true;
      lastUnit = 0;
      continue;
    }

    if (token === "belas") {
      if (lastUnit > 0) {
        currentGroup = currentGroup - lastUnit + (lastUnit + 10);
      } else {
        currentGroup += 10;
      }
      hasNumberToken = true;
      lastUnit = 0;
      continue;
    }

    if (token in BASIC_NUMBERS) {
      const val = BASIC_NUMBERS[token];
      currentGroup += val;
      lastUnit = val;
      hasNumberToken = true;
      continue;
    }

    // Unrecognized token in number string
    return null;
  }

  if (!hasNumberToken) return null;
  return total + currentGroup;
}
