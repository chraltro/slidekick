import { useEffect, useState } from 'react';
import EditorApp from './editor/EditorApp';
import AudienceApp from './audience/AudienceApp';

function detectRole(): 'editor' | 'audience' {
  if (typeof window === 'undefined') return 'editor';
  const params = new URLSearchParams(window.location.search);
  return params.get('role') === 'audience' ? 'audience' : 'editor';
}

export default function App() {
  const [role, setRole] = useState<'editor' | 'audience'>(detectRole);

  useEffect(() => {
    const onPop = () => setRole(detectRole());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // The audience window is what gets screen-shared — index.html chrome (the
  // demant.app link) hides itself off this class.
  useEffect(() => {
    document.body.classList.toggle('audience', role === 'audience');
  }, [role]);

  return role === 'audience' ? <AudienceApp /> : <EditorApp />;
}
