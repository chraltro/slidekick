import { useEffect } from 'react';
import { putAsset } from '@/storage/assetStore';
import { useDeckStore } from '@/state/useDeckStore';
import { getActiveEditorView } from './CodeMirrorEditor';

/** Listens for image paste/drop on the editor pane and inserts asset:<hash> markdown. */
export function useImagePaste(rootRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            const hash = await putAsset(f);
            insertMd(`\n![pasted image](asset:${hash})\n`);
            return;
          }
        }
      }
    };
    const onDrop = async (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f || !f.type.startsWith('image/')) return;
      e.preventDefault();
      const hash = await putAsset(f);
      insertMd(`\n![dropped image](asset:${hash})\n`);
    };
    root.addEventListener('paste', onPaste as unknown as EventListener);
    root.addEventListener('drop', onDrop as unknown as EventListener);
    root.addEventListener('dragover', preventDefault as EventListener);
    return () => {
      root.removeEventListener('paste', onPaste as unknown as EventListener);
      root.removeEventListener('drop', onDrop as unknown as EventListener);
      root.removeEventListener('dragover', preventDefault as EventListener);
    };
  }, [rootRef]);
}

function preventDefault(e: Event) {
  e.preventDefault();
}

function insertMd(snippet: string) {
  // Insert at the cursor — the editor's update listener propagates the change
  // to the store. Appending to the source instead would dump the image on the
  // last slide and reset the cursor via the full-document sync.
  const view = getActiveEditorView();
  if (view) {
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, insert: snippet },
      selection: { anchor: pos + snippet.length },
    });
    view.focus();
    return;
  }
  const state = useDeckStore.getState();
  state.setSource(state.source + snippet);
}
