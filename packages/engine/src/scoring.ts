import { bidTierStake } from './rules.js';
import { partnerOf, playerName } from './state.js';
import { type GameState, type KunukkuLevel, type RoundResult, type Seat, teamOf } from './types.js';

export function teamLabel(team: 0 | 1): string {
  return team === 0 ? 'A' : 'B';
}

// Human-readable reason for a stake above a single base card.
export function stakeReason(bid: number): string | null {
  if (bid >= 24) return '24+ bid, quadruple';
  if (bid >= 20) return '20+ bid, double';
  return null;
}

// Settle a finished round: decide the bid, move base cards, update the
// kunukku clips and decide whether the match is over.
export function finishRound(state: GameState): GameState {
  const pointsCaptured: [number, number] = [0, 0];
  const tricksWonByTeam: [number, number] = [0, 0];
  for (const t of state.completedTricks) {
    const team = teamOf(t.winnerSeat);
    pointsCaptured[team] += t.points;
    tricksWonByTeam[team] += 1;
  }

  const biddingTeam = teamOf(state.bidding.currentBidderSeat as Seat);
  const otherTeam = biddingTeam === 0 ? 1 : 0;
  const bidderSeat = state.bidding.currentBidderSeat as Seat;
  const bid = state.bidding.currentBid as number;
  const made = pointsCaptured[biddingTeam] >= bid;
  const kappu = tricksWonByTeam[biddingTeam] === 8;

  // The base-card exchange: the losing team hands base cards to the winners.
  // The bid tier sets the stake automatically: 20-23 doubles it, 24+
  // quadruples it.
  const roundWinnerTeam: 0 | 1 = made ? biddingTeam : otherTeam;
  const roundLoserTeam: 0 | 1 = roundWinnerTeam === 0 ? 1 : 0;
  const loserEnteredAtZero = state.baseCards[roundLoserTeam] === 0;
  const effectiveStake = bidTierStake(bid);
  const cardsTransferred = Math.min(effectiveStake, state.baseCards[roundLoserTeam]);
  const baseCards: [number, number] = [...state.baseCards];
  baseCards[roundLoserTeam] -= cardsTransferred;
  baseCards[roundWinnerTeam] += cardsTransferred;

  // --- Kunukku (ear-clip) bookkeeping ---
  // Each seat wears 0-2 clips. Per the authentic rule, a kunukku is shed ONLY
  // by winning your own bid as declarer - never by defending. A made low bid
  // frees just the bidder's own clip; a made bid of 20+ (which stakes 2-4
  // cards) frees both partners, so one clip is shed per staked base card.
  const kunukku = [...state.kunukku] as [KunukkuLevel, KunukkuLevel, KunukkuLevel, KunukkuLevel];
  const kunukkuMarked: Seat[] = [];
  const kunukkuCleared: Seat[] = [];
  const kunukkuDoubled: Seat[] = [];
  const addClip = (s: Seat) => {
    if (kunukku[s] >= 2) return;
    kunukku[s] = (kunukku[s] + 1) as KunukkuLevel;
    (kunukku[s] === 1 ? kunukkuMarked : kunukkuDoubled).push(s);
  };

  // Clip removal: only the declaring team, only on a made bid. Sheds one clip
  // per staked base card starting from the bidder, then the partner.
  if (made) {
    let removable = effectiveStake;
    for (const s of [bidderSeat, partnerOf(bidderSeat)]) {
      while (removable > 0 && kunukku[s] > 0) {
        kunukku[s] = (kunukku[s] - 1) as KunukkuLevel;
        removable--;
        if (!kunukkuCleared.includes(s)) kunukkuCleared.push(s);
      }
    }
  }

  // Clip additions. Per the authentic Kerala rule, a kunukku is a TEAM penalty
  // that lands only when a team's balance is wiped out - both players are
  // clipped when the team is stripped of its last base card. A single failed
  // bid or a shut-out on its own does NOT clip anyone; it only matters if it
  // strips the team to zero.
  const strippedToZero = cardsTransferred > 0 && baseCards[roundLoserTeam] === 0;
  if (strippedToZero) {
    for (const s of ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) === roundLoserTeam)) {
      addClip(s);
    }
  }
  // Sinking deeper (double kunukku): an already-clipped bidder who declares to
  // redeem their kunukku and then fails takes a second clip - on their other
  // ear, or the partner if both the bidder's ears are already full.
  if (!made && state.kunukku[bidderSeat] > 0) {
    addClip(kunukku[bidderSeat] < 2 ? bidderSeat : partnerOf(bidderSeat));
  }

  const reason = stakeReason(bid);
  const log = [
    ...state.log,
    made
      ? `Bidding team captured ${pointsCaptured[biddingTeam]} pts (needed ${bid}) — bid made${kappu ? ' with a KAPPU (all 8 kai)!' : '.'}`
      : `Bidding team captured only ${pointsCaptured[biddingTeam]} pts (needed ${bid}) — bid failed.`,
    cardsTransferred > 0
      ? `Team ${teamLabel(roundLoserTeam)} hands over ${cardsTransferred} base card${cardsTransferred > 1 ? 's' : ''}${reason ? ` (stakes: ${reason})` : ''}. Base cards: Team A ${baseCards[0]} - Team B ${baseCards[1]}.`
      : `Team ${teamLabel(roundLoserTeam)} has no base cards left to hand over.`,
  ];
  for (const s of kunukkuMarked) log.push(`${playerName(state.players, s)} wears a kunukku clip!`);
  for (const s of kunukkuCleared) log.push(`${playerName(state.players, s)} sheds a kunukku clip!`);
  for (const s of kunukkuDoubled) log.push(`${playerName(state.players, s)} takes a second kunukku clip!`);
  if (strippedToZero) {
    log.push(
      `Team ${teamLabel(roundLoserTeam)} is stripped of base cards — kunukku state! They must win a round to survive.`
    );
  }

  // Match end: reaching 12-0 alone doesn't finish it. The stripped team gets
  // a last stand - if they lose yet another round while already at zero,
  // they are broken and the match is over.
  let winner: 0 | 1 | null = loserEnteredAtZero ? roundWinnerTeam : null;
  let kunukkuBlockedWinner: 0 | 1 | null = null;
  if (winner !== null) {
    const winningSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) === winner);
    if (winningSeats.some((s) => kunukku[s] > 0)) {
      kunukkuBlockedWinner = winner;
      log.push(`Team ${teamLabel(winner)} had the match won but must clear their own kunukku first!`);
      winner = null;
    } else {
      log.push(
        `Team ${teamLabel(roundLoserTeam)} had nothing left to give — Team ${teamLabel(winner)} breaks them and wins the match!`
      );
    }
  }

  const result: RoundResult = {
    roundNumber: state.roundNumber,
    biddingTeam,
    bid,
    pointsCaptured,
    made,
    kappu,
    roundWinnerTeam,
    cardsTransferred,
    baseCardsAfter: baseCards,
    kunukkuMarked,
    kunukkuCleared,
    kunukkuDoubled,
    kunukkuBlockedWinner,
  };

  return {
    ...state,
    phase: winner !== null ? 'game_end' : 'round_end',
    baseCards,
    history: [...state.history, result],
    log,
    winner,
    trump: { ...state.trump, revealed: true },
    kunukku,
  };
}
