import { useSyncExternalStore } from 'react';
import { sounds } from '../audio/sounds';

const subscribe = (listener: () => void) => sounds.subscribe(listener);
const getMuted = () => sounds.muted;

export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useSyncExternalStore(subscribe, getMuted, getMuted);
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={() => sounds.toggle()}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
