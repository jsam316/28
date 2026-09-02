import { useEffect, useRef } from 'react';

interface RulesPanelProps {
  onClose: () => void;
}

// The rules of 28 as this app plays them, house rules included. Opened from
// the home screen and from the table.
export function RulesPanel({ onClose }: RulesPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay-card rules-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rules-header">
          <h2 id="rules-title">How to play 28</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close rules">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="rules-body">
          <section>
            <h3>The deck and the points</h3>
            <p>
              32 cards, 7 to Ace, four players in two partnerships sitting opposite each other. In every suit the
              order is <strong>J, 9, A, 10, K, Q, 8, 7</strong>. Jacks are worth 3, nines 2, aces and tens 1, the rest
              nothing: 28 points in all.
            </p>
          </section>

          <section>
            <h3>Dealing and the first bidding round</h3>
            <p>
              Each player gets four cards. The player to the dealer's left opens and <strong>must bid at least 14</strong>
              (if all four of their cards are K, Q, 8 or 7 they may demand a redeal instead). Bidding goes round to the
              left; each bid must beat the last and there is no cap short of 28. Once you pass you are out for the round.
            </p>
            <p>
              To raise over your own partner's bid you must bid <strong>at least 20</strong>.
            </p>
          </section>

          <section>
            <h3>Setting the trump aside</h3>
            <p>
              Every time someone takes the lead in the bidding they immediately choose one card from their hand and place
              it face down beside them: that card's suit is the trump, known only to them. If they are outbid, the card
              goes back into their hand and the new leader sets one aside.
            </p>
          </section>

          <section>
            <h3>The second bidding round</h3>
            <p>
              Four more cards are dealt to everyone (a hand with all four Jacks is shown and the deal is thrown in). Any
              player may now raise the bid to <strong>24 or more</strong>; the standing bidder may let their bid stand.
              Whoever holds the bid at the end is the declarer; the player to the dealer's left leads the first kai.
            </p>
          </section>

          <section>
            <h3>Playing a kai (trick)</h3>
            <p>
              You must follow suit if you can. The set-aside trump card stays out of the declarer's hand and does not
              count for following suit. Until the trump is called, <strong>trumps have no power</strong>: the highest card
              of the suit led wins the kai. The winner leads the next kai.
            </p>
            <p>
              A player who cannot follow suit may <strong>call for the trump</strong>. The declarer shows the card, it
              returns to their hand, and from then on the trump suit beats everything. The caller must play a trump to
              that kai if they hold one; after that, trumping is never compulsory. A trump-suit card played before the
              call was just a discard and never counts as a trump. If nobody calls, the declarer's last card is the trump
              itself and it is exposed as it is played.
            </p>
          </section>

          <section>
            <h3>Making the bid</h3>
            <p>
              The declaring side must capture at least as many points as their bid. The moment the defenders have
              captured more than 28 minus the bid, the round ends: the bid can no longer be made. A made bid plays out to
              the end so a <strong>kappu</strong> (all eight kai) can be claimed.
            </p>
          </section>

          <section>
            <h3>Base cards and stakes</h3>
            <p>
              Each side starts with a stack of base cards (3, 6 or 9). The losing side of every round hands base cards to
              the winners: <strong>one card</strong> for a bid under 20, <strong>two</strong> for 20 to 23 and{' '}
              <strong>four</strong> for 24 or more. A side that has no base cards left gets one last stand: losing again
              while at zero ends the match, and the other side wins.
            </p>
          </section>

          <section>
            <h3>Kunukku (the ear clip)</h3>
            <p>
              When a side is stripped of its last base card, both partners wear a kunukku clip. A clip is shed only by
              winning the bid as declarer and making it: a made bid frees one clip per base card staked, starting with
              the bidder. A clipped bidder who fails their bid sinks deeper and takes a second clip (or passes it to the
              partner once both ears are full). A side still wearing a clip cannot win the match until it is cleared.
            </p>
          </section>

          <section>
            <h3>Keyboard</h3>
            <p>
              Tab moves between cards and buttons; Enter or Space plays. During a kai the keys <strong>1 to 8</strong> play
              the matching card in your hand, and <strong>T</strong> calls for the trump when you may.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
