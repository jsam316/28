import { isRaisingOverPartner, minNextBid, type BiddingState, type Player, type Seat } from '@twenty-eight/engine';

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
  // The opener may not pass: with no bid or pass yet in round one, the only
  // choices are to open at the minimum (or redeal a pointless hand).
  const mustOpen = !secondBatchDealt && bidding.history.length === 0;
  // Raising over your own partner's standing bid requires at least 20.
  const raisingOverPartner = isRaisingOverPartner(bidding, you);
  const nextBid = minNextBid(bidding.currentBid, bidding.minBid, secondBatchDealt, raisingOverPartner);
  const options: number[] = [];
  for (let v = nextBid; v <= Math.min(bidding.maxBid, nextBid + 5); v++) options.push(v);

  const turnName = players.find((p) => p.seat === bidding.turnSeat)?.name ?? '';
  const passLabel = secondBatchDealt && bidding.currentBidderSeat === you ? 'Hold my bid' : 'Pass';

  return (
    <div className="bidding-panel">
      <div className="bidding-stage">
        {secondBatchDealt ? 'Second round — bids of 24 to 28, or let it stand' : 'First round — bidding opens at 14'}
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
      {isYourTurn && mustOpen && (
        <div className="bidding-stakes-note">You open the bidding — you must bid (no passing).</div>
      )}
      {isYourTurn && raisingOverPartner && !secondBatchDealt && (
        <div className="bidding-stakes-note">Raising over your partner — minimum bid 20.</div>
      )}
      {isYourTurn && (
        <div className="bidding-actions">
          {!mustOpen && (
            <button type="button" className="btn btn-pass" onClick={() => onBid('pass')}>
              {passLabel}
            </button>
          )}
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
