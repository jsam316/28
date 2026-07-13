import type { Card, Suit } from '@twenty-eight/engine';
import { PlayingCard, suitName, suitSymbol } from './Card';

interface TrumpPanelProps {
  hand: Card[];
  bidAmount: number;
  onChoose: (suit: Suit) => void;
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function TrumpPanel({ hand, bidAmount, onChoose }: TrumpPanelProps) {
  return (
    <div className="trump-panel">
      <h3>You won the bid at {bidAmount}! Pick your trump suit (kept hidden until called).</h3>
      <div className="trump-panel-hand">
        {hand.map((c) => (
          <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="md" />
        ))}
      </div>
      <div className="trump-suit-options">
        {SUITS.map((s) => (
          <button key={s} type="button" className={`btn btn-suit suit-${s}`} onClick={() => onChoose(s)}>
            <span className="suit-symbol">{suitSymbol(s)}</span> {suitName(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
