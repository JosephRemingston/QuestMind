import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
const regular = fileURLToPath(new URL('../../assets/fonts/NotoSans-Regular.ttf', import.meta.url));
const bold = fileURLToPath(new URL('../../assets/fonts/NotoSans-Bold.ttf', import.meta.url));
export function renderPaper(paper, answerKey = false) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `${paper.title}${answerKey ? ' - Answer Key' : ''}`, Author: env.PDF_TITLE } });
    const buffers = []; doc.on('data', b => buffers.push(b)); doc.on('end', () => resolve(Buffer.concat(buffers))); doc.on('error', reject);
    try {
      const mapping = JSON.parse(env.PDF_FONTS_JSON), fonts = mapping[paper.medium];
      doc.registerFont('Body', fonts?.regular || env.PDF_FONT_PATH || regular); doc.registerFont('Heading', fonts?.bold || env.PDF_BOLD_FONT_PATH || bold);
      const checkGlyphs = text => {
        const font = doc._font.font;
        if (font && [...text].some(c => !/\s/.test(c) && !font.hasGlyphForCodePoint(c.codePointAt(0)))) throw new ApiError(422, `Configure a PDF font supporting this paper's script and symbols`, 'PDF_FONT_UNSUPPORTED');
      };
      const text = (value, options = {}) => { const s = String(value ?? ''); checkGlyphs(s); doc.text(s, options); };
      const room = height => { if (doc.y + height > doc.page.height - 65) doc.addPage(); };
      doc.font('Heading').fontSize(11).fillColor('#4b5563'); text(env.PDF_TITLE.toUpperCase()); doc.moveDown(0.7);
      doc.fontSize(20).fillColor('#111827'); text(`${paper.title}${answerKey ? ' - Answer Key' : ''}`); doc.moveDown(0.7);
      doc.font('Body').fontSize(10); text(`${paper.subject}  |  Class ${paper.classLevel}  |  ${paper.board}  |  ${paper.medium}`); doc.moveDown(0.4);
      text(`Duration: ${paper.durationMinutes} minutes                 Maximum marks: ${paper.totalMarks}`); doc.moveDown();
      if (!answerKey) { text('Instructions: Read all questions carefully. Marks are shown with each question. Show working where required. Follow the choices stated in each section.'); doc.moveDown(); }
      paper.sections.forEach((section, sectionIndex) => {
        room(75); doc.moveDown(0.5); doc.font('Heading').fontSize(13);
        text(`${section.name} (${section.totalMarks} marks)`); doc.moveDown(0.4); doc.font('Body').fontSize(10);
        if (section.choiceCount) { text(`Answer any ${section.count - section.choiceCount} of the following ${section.count} questions.`); doc.moveDown(0.4); }
        if (section.instructions) { text(section.instructions); doc.moveDown(0.5); }
        for (const q of paper.questions.filter(q => q.sectionIndex === sectionIndex)) {
          const body = answerKey ? `${q.questionNumber}. ${q.correctAnswer}\n${q.explanation}\nSource: page ${q.source.page}` : `${q.questionNumber}. ${q.question}  [${q.marks} ${q.marks === 1 ? 'mark' : 'marks'}]`;
          const height = doc.heightOfString(body, { width: 499 }) + (answerKey ? 0 : q.options.reduce((n, o) => n + doc.heightOfString(o, { width: 475 }) + 4, 0)) + 16;
          // Keep normal questions and their options together; very long answers flow across pages.
          room(Math.min(height, 590)); text(body, { lineGap: 3 });
          if (!answerKey) q.options.forEach((option, i) => { doc.moveDown(0.25); text(`   ${String.fromCharCode(65 + i)}. ${option}`, { lineGap: 2 }); });
          doc.moveDown(0.9);
        }
      });
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
        doc.font('Body').fontSize(8).fillColor('#6b7280').text(`Page ${i + 1} of ${range.count}`, 48, doc.page.height - 35, { width: doc.page.width - 96, align: 'center', lineBreak: false }); doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
