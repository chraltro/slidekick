/**
 * Pure DOM-based helpers for splitting the rendered HTML of a slide into
 * the parts each layout consumes (image, caption, columns, etc.).
 * Runs on the client; uses DOMParser.
 */

export interface SplitTitleParts {
  titleHtml: string;
  subtitleHtml?: string;
  rest: string;
}

export interface SplitImageParts {
  imageHtml?: string;
  bodyHtml: string;
  caption?: string;
}

export interface SplitColumnsParts {
  headerHtml?: string;
  leftHtml: string;
  rightHtml: string;
}

export interface SplitQuoteParts {
  quoteHtml?: string;
  attribution?: string;
  rest: string;
}

export interface SplitCodeParts {
  headerHtml?: string;
  codePlaceholderHtml?: string;
  rest: string;
}

function parse(html: string): HTMLBodyElement {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return doc.body as HTMLBodyElement;
}

function serialize(nodes: ChildNode[]): string {
  return nodes.map((n) => (n.nodeType === 1 ? (n as Element).outerHTML : n.nodeType === 3 ? n.textContent ?? '' : '')).join('');
}

export function splitTitle(html: string): SplitTitleParts {
  const body = parse(html);
  const children = Array.from(body.childNodes);
  let titleEl: Element | undefined;
  let subtitleEl: Element | undefined;
  const rest: ChildNode[] = [];
  for (const child of children) {
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    if (!titleEl && el.tagName === 'H1') {
      titleEl = el;
      continue;
    }
    if (titleEl && !subtitleEl && el.tagName === 'H2') {
      subtitleEl = el;
      continue;
    }
    rest.push(child);
  }
  return {
    titleHtml: titleEl?.innerHTML ?? '',
    subtitleHtml: subtitleEl?.innerHTML,
    rest: rest.map((n) => (n.nodeType === 1 ? (n as Element).outerHTML : '')).join(''),
  };
}

export function splitImage(html: string): SplitImageParts {
  const body = parse(html);
  const imgEl = body.querySelector('img');
  let imageHtml: string | undefined;
  let caption: string | undefined;
  if (imgEl) {
    imageHtml = imgEl.outerHTML;
    if (imgEl.alt) caption = imgEl.alt;
    // Remove the wrapping paragraph if it only contains the image
    const parent = imgEl.parentElement;
    if (parent && parent.children.length === 1 && parent.tagName === 'P') {
      parent.remove();
    } else {
      imgEl.remove();
    }
  }
  return { imageHtml, bodyHtml: body.innerHTML, caption };
}

export function splitColumns(html: string): SplitColumnsParts {
  const body = parse(html);
  const children = Array.from(body.childNodes);
  let headerHtml: string | undefined;
  let splitIdx = -1;
  // If the first element is an H1 or H2, lift it as a full-width slide title.
  // Skip whitespace text nodes when looking for the first element.
  let firstElIdx = -1;
  for (let i = 0; i < children.length; i++) {
    if (children[i].nodeType === 1) {
      firstElIdx = i;
      break;
    }
  }
  if (firstElIdx >= 0) {
    const first = children[firstElIdx] as Element;
    if (first.tagName === 'H1' || first.tagName === 'H2') {
      headerHtml = first.outerHTML;
      children.splice(firstElIdx, 1);
    }
  }
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.nodeType === 1 && (c as Element).tagName === 'HR') {
      splitIdx = i;
      break;
    }
  }
  if (splitIdx === -1) {
    return { headerHtml, leftHtml: serialize(children), rightHtml: '' };
  }
  const left = children.slice(0, splitIdx);
  const right = children.slice(splitIdx + 1);
  return { headerHtml, leftHtml: serialize(left), rightHtml: serialize(right) };
}

export function splitQuote(html: string): SplitQuoteParts {
  const body = parse(html);
  const bq = body.querySelector('blockquote');
  let quoteHtml: string | undefined;
  let attribution: string | undefined;

  // Match common attribution prefixes: em-dash, en-dash, double-dash,
  // double-hyphen-with-arrow, tilde, and "by".
  const ATTRIB_RE = /^\s*(?:—|--|–|―|~|by\s+)\s*/i;

  if (bq) {
    const ps = Array.from(bq.querySelectorAll('p'));
    const last = ps[ps.length - 1];
    if (last) {
      // The last <p> may itself have multiple lines (joined by <br>). If the
      // FINAL line of that paragraph matches an attribution prefix, extract
      // it as attribution and keep the rest of the paragraph in the quote.
      const fullText = last.innerHTML;
      // Split on <br> to inspect last visible line.
      const lines = fullText.split(/<br\s*\/?>/i);
      const lastLine = (lines[lines.length - 1] ?? '').trim();
      if (lastLine && ATTRIB_RE.test(stripTags(lastLine))) {
        attribution = stripTags(lastLine).replace(ATTRIB_RE, '').trim();
        if (lines.length === 1) {
          last.remove();
        } else {
          last.innerHTML = lines.slice(0, -1).join('<br>').replace(/<br>\s*$/, '');
        }
      } else if (last && ATTRIB_RE.test(last.textContent ?? '')) {
        // Whole last paragraph is attribution
        attribution = (last.textContent ?? '').replace(ATTRIB_RE, '').trim();
        last.remove();
      }
    }
    quoteHtml = bq.innerHTML;
    bq.remove();
  }
  return { quoteHtml, attribution, rest: body.innerHTML };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export function splitCode(html: string): SplitCodeParts {
  const body = parse(html);
  const children = Array.from(body.childNodes);
  let headerHtml: string | undefined;
  if (children[0] && (children[0] as Element).tagName === 'H2') {
    headerHtml = (children[0] as Element).outerHTML;
    (children[0] as Element).remove();
  }
  const placeholder = body.querySelector('.codeblock-placeholder');
  let codePlaceholderHtml: string | undefined;
  if (placeholder) {
    codePlaceholderHtml = placeholder.outerHTML;
    placeholder.remove();
  }
  return { headerHtml, codePlaceholderHtml, rest: body.innerHTML };
}
