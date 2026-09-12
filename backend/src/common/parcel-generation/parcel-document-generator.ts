import sharp from 'sharp';

// A synthetic "Record of Rights" copy image for a parcel's seeded land
// property papers (backend/src/parcels/parcel-document.entity.ts) - same
// sharp-rasterizes-an-SVG approach cluster-snapshot-generator.ts already
// uses for historical imagery, just SVG <text> instead of polygons. Not a
// real scan of anything - consistent with every other piece of demo data in
// this project.
export const DOCUMENT_WIDTH = 850;
export const DOCUMENT_HEIGHT = 1100;

export interface ParcelDocumentFields {
  ownerName: string;
  surveyNumber: string;
  areaSqM: number;
  stateCode: string;
  districtCode: string;
  registrationStatus: string;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function renderParcelDocumentImage(fields: ParcelDocumentFields): Promise<Buffer> {
  const rows: Array<[string, string]> = [
    ['Owner Name', fields.ownerName],
    ['Survey / Plot Number', fields.surveyNumber],
    ['Area', `${fields.areaSqM.toLocaleString()} sqm`],
    ['State', fields.stateCode],
    ['District', fields.districtCode],
    ['Registration Status', fields.registrationStatus],
  ];

  const rowsSvg = rows
    .map(([label, value], i) => {
      const y = 260 + i * 70;
      return (
        `<text x="60" y="${y}" font-family="monospace" font-size="20" fill="#5a5240">${escapeXml(label)}</text>` +
        `<text x="60" y="${y + 28}" font-family="monospace" font-size="28" font-weight="bold" fill="#1f2417">${escapeXml(value)}</text>`
      );
    })
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DOCUMENT_WIDTH}" height="${DOCUMENT_HEIGHT}">` +
    `<rect width="100%" height="100%" fill="#f4f1ea" />` +
    `<rect x="20" y="20" width="${DOCUMENT_WIDTH - 40}" height="${DOCUMENT_HEIGHT - 40}" fill="none" stroke="#1f2417" stroke-width="4" />` +
    `<text x="60" y="110" font-family="monospace" font-size="34" font-weight="bold" fill="#1f2417">RECORD OF RIGHTS</text>` +
    `<text x="60" y="150" font-family="monospace" font-size="18" fill="#5a5240">Government Land Records - BhoomiSetu</text>` +
    `<line x1="60" y1="180" x2="${DOCUMENT_WIDTH - 60}" y2="180" stroke="#1f2417" stroke-width="2" />` +
    rowsSvg +
    `</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
