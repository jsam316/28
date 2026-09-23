import { useEffect, useRef } from 'react';

interface LogPanelProps {
  log: string[];
  onClose: () => void;
}

// The whole log of the current round (and the settlement of the last one),
// newest at the bottom - for checking exactly what happened in a kai.
export function LogPanel({ log, onClose }: LogPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    endRef.current?.scrollIntoView({ block: 'end' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay-card rules-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rules-header">
          <h2 id="log-title">This round so far</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close log">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <ol className="rules-body log-list">
          {log.map((line, i) => (
            <li key={i} ref={i === log.length - 1 ? endRef : undefined}>
              {line}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
