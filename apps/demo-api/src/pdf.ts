// A tiny single-page PDF writer for the Export PDF feature: Helvetica text lines, nothing else.
// Enough to download a real, openable report without a PDF library.

const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?');

export function textPdf(lines: { text: string; size?: number; gap?: number }[]): Buffer {
  let y = 790;
  const ops = lines.map(({ text, size = 11, gap = 18 }) => {
    const op = `BT /F1 ${size} Tf 56 ${y} Td (${escape(text)}) Tj ET`;
    y -= gap;
    return op;
  });
  const stream = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) body += `${String(o).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
