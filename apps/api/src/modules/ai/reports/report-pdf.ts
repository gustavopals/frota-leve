import PDFDocument from 'pdfkit';

/**
 * Renderiza o markdown do relatório em PDF.
 *
 * O ROADMAP sugeria Puppeteer; usamos pdfkit para não arrastar o Chromium
 * (~300MB) para a imagem de produção. O markdown gerado é simples — headings,
 * parágrafos e listas — e não precisa de um motor de layout HTML completo.
 */
export function renderReportPdf(params: {
  title: string;
  period: string;
  summary: string;
  markdown: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text(params.title);
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#555555').text(`Período: ${params.period}`);
    doc.moveDown(0.8);

    if (params.summary) {
      doc.fontSize(11).font('Helvetica-Oblique').fillColor('#333333').text(params.summary);
      doc.moveDown(1);
    }

    doc.fillColor('#000000');

    for (const rawLine of params.markdown.split('\n')) {
      const line = rawLine.trimEnd();

      if (line.length === 0) {
        doc.moveDown(0.5);
        continue;
      }

      if (line.startsWith('## ')) {
        doc.moveDown(0.4);
        doc.fontSize(14).font('Helvetica-Bold').text(line.slice(3));
        doc.moveDown(0.2);
        continue;
      }

      if (line.startsWith('# ')) {
        doc.fontSize(17).font('Helvetica-Bold').text(line.slice(2));
        doc.moveDown(0.3);
        continue;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        doc
          .fontSize(11)
          .font('Helvetica')
          .text(`• ${stripInlineMarkdown(line.slice(2))}`, { indent: 12 });
        continue;
      }

      doc.fontSize(11).font('Helvetica').text(stripInlineMarkdown(line));
    }

    doc.end();
  });
}

/** Remove ênfase e código inline — pdfkit não interpreta markdown. */
function stripInlineMarkdown(value: string): string {
  return value
    .replaceAll(/\*\*(.+?)\*\*/g, '$1')
    .replaceAll(/\*(.+?)\*/g, '$1')
    .replaceAll(/`(.+?)`/g, '$1');
}
