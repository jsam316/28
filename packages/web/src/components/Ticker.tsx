interface TickerProps {
  log: string[];
}

// The latest event, faded in each time a new line arrives. The full history
// lives in the round log (the ≡ button), so this stays one calm line rather
// than a scrolling marquee. Screen readers get the same line from the live
// region in GameScreen, so this one is hidden from them.
export function Ticker({ log }: TickerProps) {
  const latest = log[log.length - 1];
  if (!latest) return null;
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-line" key={log.length}>
        {latest}
      </div>
    </div>
  );
}
