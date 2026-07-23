import type { Card } from '@twenty-eight/engine';
import { PlayingCard } from './Card';

interface TrumpPanelProps {
  hand: Card[];
  bidAmount: number;
  onChoose: (card: Card) => void;
}

export function TrumpPanel({ hand, bidAmount, onChoose }: TrumpPanelProps) {
  return (
    <div className="trump-panel">
      <h3>You won the bid at {bidAmount}! Tap a card to set aside as your trump — its suit stays hidden until called.</h3>
      <div className="trump-panel-hand">
        {hand.map((c) => (
          <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="md" onClick={() => onChoose(c)} />
        ))}
      </div>
    </div>
  );
}
