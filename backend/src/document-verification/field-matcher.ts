// Pure, OCR/DB-independent matching helpers - deliberately tolerant of the
// noise real OCR output has (inconsistent spacing around punctuation, mixed
// case, stray line breaks) rather than requiring an exact string match.

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

// Identifiers (survey numbers, ULPINs, plot numbers) are short, distinctive
// alphanumeric codes - a whitespace-insensitive substring match is enough,
// and avoids false negatives from OCR inserting/dropping spaces around
// slashes or hyphens (e.g. "45/7" read as "45 / 7").
export function textContainsIdentifier(ocrText: string, identifierValue: string): boolean {
  if (!identifierValue) return false;
  return normalize(ocrText).includes(normalize(identifierValue));
}

// Names are harder: OCR can misread individual characters, and a real
// document might print "A. Sharma" for "Amit Sharma". Rather than demanding
// an exact match, this counts how many of the expected name's words appear
// (as whole words, case-insensitively) anywhere in the text and requires a
// majority - tolerant of one misread word without accepting an unrelated name.
export function textContainsName(ocrText: string, expectedName: string): boolean {
  const words = expectedName.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return false;
  const lowerText = ocrText.toLowerCase();
  const matchedCount = words.filter((word) => lowerText.includes(word)).length;
  return matchedCount / words.length >= 0.6;
}

// Finds any number in the OCR text within a tolerance of the expected value
// - real documents print area with varying decimal precision/rounding, and
// OCR itself can misread a digit, so an exact match would be unreasonably
// strict for a scanned/photographed document.
export function textContainsApproxNumber(ocrText: string, expected: number, tolerancePct = 0.05): boolean {
  const numbers = (ocrText.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return numbers.some((n) => Math.abs(n - expected) <= expected * tolerancePct);
}
