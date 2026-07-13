interface LogPanelProps {
  log: string[];
}

export function LogPanel({ log }: LogPanelProps) {
  const recent = log.slice(-5).reverse();
  return (
    <div className="log-panel">
      {recent.map((line, i) => (
        <div key={log.length - i} className={`log-line ${i === 0 ? 'log-line-latest' : ''}`}>
          {line}
        </div>
      ))}
    </div>
  );
}
