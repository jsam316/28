// A row of base-card chips for each team, so the state of the match reads at
// a glance on the round and match result screens.
interface BaseCardTallyProps {
  baseCards: [number, number];
  totalBaseCards: number;
}

function Row({ team, count, total }: { team: 0 | 1; count: number; total: number }) {
  return (
    <div className={`tally-row team-${team}`}>
      <span className="tally-label">Team {team === 0 ? 'A' : 'B'}</span>
      <span className="tally-chips" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`tally-chip ${i < count ? 'on' : ''}`} />
        ))}
      </span>
      <span className="tally-count">{count}</span>
    </div>
  );
}

export function BaseCardTally({ baseCards, totalBaseCards }: BaseCardTallyProps) {
  return (
    <div className="tally" aria-label={`Base cards: Team A ${baseCards[0]}, Team B ${baseCards[1]}`}>
      <Row team={0} count={baseCards[0]} total={totalBaseCards} />
      <Row team={1} count={baseCards[1]} total={totalBaseCards} />
    </div>
  );
}
