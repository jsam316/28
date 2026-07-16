import type { BiddingState, Player, Seat } from '@twenty-eight/engine';

interface BiddingPanelProps {
  bidding: BiddingState;
  you: Seat;
  players: Player[];
  secondBatchDealt: boolean;
  onBid: (value: 'pass' | number) => void;
}

export function BiddingPanel({ bidding, you, players, secondBatchDealt, onBid }: BiddingPanelProps) {
  const isYourTurn = bidding.turnSeat === you && !bidding.passed[you];
  const nextBid = bidding.currentBid === null ? bidding.minBid : bidding.currentBid + 1;
  const options: number[] = [];
  for (let v = nextBid; v <= Math.min(bidding.maxBid, nextBid + 5); v++) options.push(v);

  const turnName = players.find((p) => p.seat === bidding.turnSeat)?.name ?? '';
  const passLabel = secondBatchDealt && bidding.currentBidderSeat === you ? 'Hold my bid' : 'Pass';

  return (
    <div className="bidding-panel">
      <div className="bidding-stage">
        {secondBatchDealt ? 'Final bidding round — raise or let it stand' : 'Bidding — round 1'}
      </div>
      <div className="bidding-status">
        <strong>{bidding.currentBid === null ? 'No bid yet' : `Current bid: ${bidding.currentBid}`}</strong>
        {bidding.currentBidderSeat !== null && (
          <span> by {players.find((p) => p.seat === bidding.currentBidderSeat)?.name}</span>
        )}
        <div className="bidding-turn">{isYourTurn ? "Your turn to bid" : `Waiting for ${turnName}...`}</div>
      </div>
      {isYourTurn && (
        <div className="bidding-actions">
          <button type="button" className="btn btn-pass" onClick={() => onBid('pass')}>
            {passLabel}
          </button>
          {options.map((v) => (
            <button key={v} type="button" className="btn btn-bid" onClick={() => onBid(v)}>
              Bid {v}
            </button>
          ))}
          {bidding.maxBid > nextBid + 5 && (
            <button type="button" className="btn btn-bid" onClick={() => onBid(bidding.maxBid)}>
              Bid {bidding.maxBid} (max)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
