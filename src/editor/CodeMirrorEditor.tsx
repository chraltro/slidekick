import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput, HighlightStyle } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { tags as t } from '@lezer/highlight';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onCursorSlide?: (slideIndex: number) => void;
  /**
   * Boundaries (character offsets) of slides in the current source — used to
   * compute which slide the cursor is in.
   */
  slideRanges?: { start: number; end: number }[];
}

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0f0f12',
      color: '#e4e4ea',
      height: '100%',
    },
    '.cm-content': { caretColor: '#cba6f7' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#cba6f7' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: '#3a3a45',
    },
    '.cm-gutters': {
      backgroundColor: '#0f0f12',
      color: '#5a5a66',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: '#16161c' },
    '.cm-activeLineGutter': { backgroundColor: '#16161c' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
);

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, color: '#cba6f7', fontWeight: '700', fontSize: '1.15em' },
  { tag: t.heading2, color: '#f5c2e7', fontWeight: '700' },
  { tag: t.heading3, color: '#94e2d5', fontWeight: '600' },
  { tag: t.strong, color: '#f9e2af', fontWeight: '700' },
  { tag: t.emphasis, color: '#fab387', fontStyle: 'italic' },
  { tag: t.link, color: '#89b4fa', textDecoration: 'underline' },
  { tag: t.url, color: '#89b4fa' },
  { tag: t.monospace, color: '#a6e3a1' },
  { tag: t.list, color: '#cba6f7' },
  { tag: t.quote, color: '#a6adc8', fontStyle: 'italic' },
  { tag: t.comment, color: '#6c7086', fontStyle: 'italic' },
]);

// The mounted view, for imperative helpers (image paste inserts at the cursor).
let activeView: EditorView | null = null;
export function getActiveEditorView(): EditorView | null {
  return activeView;
}

export default function CodeMirrorEditor({ value, onChange, onCursorSlide, slideRanges }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorSlideRef = useRef(onCursorSlide);
  const slideRangesRef = useRef(slideRanges);
  // Last doc string this editor emitted via onChange — lets the external-value
  // sync effect skip an O(doc) stringify on every keystroke round-trip.
  const lastEmittedRef = useRef(value);

  onChangeRef.current = onChange;
  onCursorSlideRef.current = onCursorSlide;
  slideRangesRef.current = slideRanges;

  // Mount once
  useEffect(() => {
    if (!hostRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        syntaxHighlighting(mdHighlight),
        markdown(),
        editorTheme,
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const next = update.state.doc.toString();
            lastEmittedRef.current = next;
            onChangeRef.current(next);
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head;
            const ranges = slideRangesRef.current ?? [];
            for (let i = 0; i < ranges.length; i++) {
              // The last range is end-inclusive: the cursor usually sits at the
              // very end of the doc while writing, and trailing whitespace is
              // trimmed out of the parsed ranges.
              const inRange =
                pos >= ranges[i].start && (pos < ranges[i].end || i === ranges.length - 1);
              if (inRange) {
                onCursorSlideRef.current?.(i);
                break;
              }
            }
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: hostRef.current,
    });
    viewRef.current = view;
    activeView = view;
    // Expose for tests/debug. Harmless in prod (a single global ref).
    (window as unknown as { __cmView?: EditorView }).__cmView = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      if (activeView === view) activeView = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. after loading a deck from IDB)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    // Fast path: this value is the editor's own keystroke echoing back.
    if (lastEmittedRef.current === value) return;
    lastEmittedRef.current = value;
    if (view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} className="h-full w-full" />;
}

export function scrollEditorToOffset(view: EditorView | null, offset: number) {
  if (!view) return;
  view.dispatch({
    selection: { anchor: offset },
    effects: EditorView.scrollIntoView(offset, { y: 'center' }),
  });
}
