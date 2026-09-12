import Tesseract from 'tesseract.js';

// Thin wrapper around tesseract.js (local, in-process OCR - no external API
// key, no network call per request) so the rest of this module doesn't
// depend on tesseract.js's own API shape directly, matching how
// change-detection/image-diff.ts isolates sharp/pixel-diffing from the
// service that calls it.
export interface OcrResult {
  text: string;
  confidence: number; // 0-100, tesseract's own mean confidence across recognized words
}

export async function extractText(imageBuffer: Buffer): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageBuffer, 'eng');
  return { text: data.text, confidence: data.confidence };
}
