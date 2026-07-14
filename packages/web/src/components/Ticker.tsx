import { useEffect, useState } from 'react';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return reduced;
}

interface TickerProps {
  log: string[];
}

export function Ticker({ log }: TickerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const recent = log.slice(-12);
  if (recent.length === 0) return null;

  if (reducedMotion) {
    return (
      <div className="ticker ticker-static">
        <div className="ticker-line">{recent[recent.length - 1]}</div>
      </div>
    );
  }

  return (
    <div className="ticker">
      <div className="ticker-track">
        {recent.map((line, i) => (
          <div className="ticker-line" key={`a-${i}`}>
            {line}
          </div>
        ))}
        {recent.map((line, i) => (
          <div className="ticker-line" aria-hidden="true" key={`b-${i}`}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
