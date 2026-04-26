import { downloadFile } from './exportHtml';

export function exportDeckMd(source: string, title: string) {
  const filename = `${(title || 'deck').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.md`;
  downloadFile(filename, source, 'text/markdown');
}
