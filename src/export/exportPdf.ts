import type { ParsedDeck } from '@/slides/types';
import { exportDeckHtml } from './exportHtml';

/**
 * PDF export — opens the exported HTML in a hidden iframe and triggers the
 * browser's print dialog with a print-friendly stylesheet so the user can
 * "Save as PDF" or send to a real printer. Handles all slides as separate
 * pages.
 */
export async function exportDeckPdf(deck: ParsedDeck, title: string): Promise<void> {
  const html = await exportDeckHtml(deck, title);
  const printableHtml = html.replace(
    '</head>',
    `<style media="print">
      @page { size: ${deck.config.aspect === '4:3' ? '14.4in 10.8in' : deck.config.aspect === '1:1' ? '10.8in 10.8in' : '19.2in 10.8in'}; margin: 0; }
      html, body { background: #000 !important; overflow: visible !important; }
      #stage { display: block !important; position: static !important; inset: auto !important; overflow: visible !important; }
      #scaler { transform: none !important; position: static !important; display: block !important; top: auto !important; left: auto !important; }
      #scaler > .slide, #scaler > .slide.is-active { display: block !important; page-break-after: always; page-break-inside: avoid; break-after: page; }
      #scaler > .slide:last-child { page-break-after: auto; }
      .footer-controls, #progress, #overview { display: none !important; }
    </style>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script>
    </head>`,
  );

  const popup = window.open('', '_blank', 'width=1280,height=720');
  if (!popup) {
    alert('Popup blocked — allow popups for this site to export PDF.');
    return;
  }
  popup.document.open();
  popup.document.write(printableHtml);
  popup.document.close();
}
