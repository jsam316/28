import { maxBidFor, minNextBid, type BiddingState, type Player, type Seat } from '@twenty-eight/engine';

interface BiddingPanelProps {
  bidding: BiddingState;
  you: Seat;
  players: Player[];
  secondBatchDealt: boolean;
  canDemandRedeal: boolean;
  onBid: (value: 'pass' | number) => void;
  onRedeal: () => void;
}

export function BiddingPanel({
  bidding,
  you,
  players,
  secondBatchDealt,
  canDemandRedeal,
  onBid,
  onRedeal,
}: BiddingPanelProps) {
  const isYourTurn = bidding.turnSeat === you && !bidding.passed[you];
  const nextBid = minNextBid(bidding.currentBid, bidding.minBid, secondBatchDealt);
  const roundMax = maxBidFor(secondBatchDealt, bidding.maxBid);
  const options: number[] = [];
  for (let v = nextBid; v <= Math.min(roundMax, nextBid + 5); v++) options.push(v);

  const turnName = players.find((p) => p.seat === bidding.turnSeat)?.name ?? '';
  const passLabel = secondBatchDealt && bidding.currentBidderSeat === you ? 'Hold my bid' : 'Pass';

  return (
    <div className="bidding-panel">
      <div className="bidding-stage">
        {secondBatchDealt ? 'Second round — bids of 24 to 28, or let it stand' : 'First round — bids of 14 to 23'}
        <div className="bidding-stakes-note">Stakes: 20–23 bids double (2 cards), 24+ quadruple (4 cards)</div>
      </div>
      <div className="bidding-status">
        <strong>{bidding.currentBid === null ? 'No bid yet' : `Current bid: ${bidding.currentBid}`}</strong>
        {bidding.currentBidderSeat !== null && (
          <span> by {players.find((p) => p.seat === bidding.currentBidderSeat)?.name}</span>
        )}
        <div className="bidding-turn">{isYourTurn ? 'Your turn to bid' : `Waiting for ${turnName}...`}</div>
      </div>
      {canDemandRedeal && (
        <div className="redeal-offer">
          <div className="redeal-note">Your four cards hold no points — you may throw the hand in.</div>
          <button type="button" className="btn btn-danger btn-redeal" onClick={onRedeal}>
            Demand a redeal
          </button>
        </div>
      )}
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
          {roundMax > nextBid + 5 && (
            <button type="button" className="btn btn-bid" onClick={() => onBid(roundMax)}>
              Bid {roundMax} (max)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
