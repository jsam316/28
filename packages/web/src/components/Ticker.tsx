interface TickerProps {
  log: string[];
}

export function Ticker({ log }: TickerProps) {
  const recent = log.slice(-15);
  if (recent.length === 0) return null;
  const text = recent.join('    •    ');

  return (
    <div className="ticker">
      <div className="ticker-track">
        <span className="ticker-content">{text}</span>
        <span className="ticker-content" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
}
