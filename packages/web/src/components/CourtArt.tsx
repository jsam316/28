import type { Card } from '@twenty-eight/engine';
import { isRedSuit } from '../utils/cards';
import { SuitPath } from './SuitIcon';

// Court card artwork: a half-length figure, mirrored top and bottom like a
// traditional deck, drawn as inline SVG so it scales crisply at every card
// size and needs nothing fetched (the Content Security Policy is unchanged).
// King: crown, beard and sceptre. Queen: tiara, long hair and a rose.
// Jack: feathered cap. Red suits wear red robes with blue trim; black suits
// the reverse, so the four suits read apart at a glance.

const INK = '#2b1d14';
const SKIN = '#f2d3ad';
const GOLD = '#d4a72c';
const GOLD_LIGHT = '#f2d886';
const RED = '#b3263a';
const BLUE = '#1f467f';
const IVORY = '#fcf8ee';

interface Palette {
  robe: string;
  trim: string;
  suit: string;
}

function paletteFor(suit: Card['suit']): Palette {
  return isRedSuit(suit) ? { robe: RED, trim: BLUE, suit: '#a62637' } : { robe: BLUE, trim: RED, suit: '#1c1a17' };
}

const HAIR: Record<'K' | 'Q' | 'J', string> = { K: '#77706a', Q: '#6b3a1f', J: '#3d2a1a' };

// The suit emblem the figure holds: a gold-ringed medallion.
function Emblem({ suit, color, x, y }: { suit: Card['suit']; color: string; x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5} fill={IVORY} stroke={GOLD} strokeWidth={1} />
      <circle cx={x} cy={y} r={4.1} fill="none" stroke={INK} strokeWidth={0.3} opacity={0.5} />
      <SuitPath suit={suit} x={x} y={y} size={5.6} fill={color} />
    </g>
  );
}

// The large suit medallion where the two halves meet, so the suit reads at a
// glance even on a small card, the way the pip does on the number cards.
function CentreSuit({ suit, color }: { suit: Card['suit']; color: string }) {
  return (
    <g>
      <circle cx={30} cy={46} r={9.6} fill={IVORY} stroke={GOLD} strokeWidth={1.4} />
      <circle cx={30} cy={46} r={8.2} fill="none" stroke={INK} strokeWidth={0.35} opacity={0.45} />
      <SuitPath suit={suit} x={30} y={46} size={11.6} fill={color} />
    </g>
  );
}

function Face() {
  return (
    <g>
      <rect x={27.5} y={21} width={5} height={6} fill={SKIN} stroke={INK} strokeWidth={0.5} />
      <ellipse cx={30} cy={16.5} rx={6} ry={7} fill={SKIN} stroke={INK} strokeWidth={0.7} />
      {/* brows, eyes, nose, mouth */}
      <path d="M26.2 14.2 Q27.6 13.3 29 14.1 M31 14.1 Q32.4 13.3 33.8 14.2" stroke={INK} strokeWidth={0.45} fill="none" strokeLinecap="round" />
      <ellipse cx={27.7} cy={15.8} rx={0.65} ry={0.5} fill={INK} />
      <ellipse cx={32.3} cy={15.8} rx={0.65} ry={0.5} fill={INK} />
      <path d="M30 16.2 L29.3 19 L30.6 19.2" stroke={INK} strokeWidth={0.4} fill="none" strokeLinejoin="round" />
      <path d="M28.3 21 Q30 21.9 31.7 21" stroke="#9c3b2e" strokeWidth={0.6} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Robe({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M6 46 L7.5 35 C8 31.6 13 30.8 20 30.5 L40 30.5 C47 30.8 52 31.6 52.5 35 L54 46 Z" fill={p.robe} stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      {/* gold hem along the shoulders */}
      <path d="M8.3 34.4 C9.2 32.3 14 31.4 20 31.1 M51.7 34.4 C50.8 32.3 46 31.4 40 31.1" stroke={GOLD} strokeWidth={0.8} fill="none" />
      {/* folds */}
      <path d="M20 46 C20.5 41 21.5 37 23 33.5 M40 46 C39.5 41 38.5 37 37 33.5" stroke={INK} strokeWidth={0.35} fill="none" opacity={0.4} />
      {/* central trim band with gold studs */}
      <path d="M26 30.5 L34 30.5 L33.3 46 L26.7 46 Z" fill={p.trim} stroke={INK} strokeWidth={0.5} />
      <circle cx={30} cy={39} r={0.85} fill={GOLD_LIGHT} />
      <circle cx={30} cy={42.6} r={0.85} fill={GOLD_LIGHT} />
      {/* sleeves */}
      <path d="M8.6 34.5 C10.6 38.6 13 41.6 16.2 43.6 L19 41 C16.6 39 14.8 36 14 31.4 Z" fill={p.trim} stroke={INK} strokeWidth={0.45} strokeLinejoin="round" />
      <path d="M51.4 34.5 C49.4 38.6 47 41.6 43.8 43.6 L41 41 C43.4 39 45.2 36 46 31.4 Z" fill={p.trim} stroke={INK} strokeWidth={0.45} strokeLinejoin="round" />
      <path d="M15.6 42.9 L18.6 40.4 M44.4 42.9 L41.4 40.4" stroke={GOLD} strokeWidth={0.9} />
      {/* gold collar */}
      <path d="M20 30.6 L30 37 L40 30.6 L37.5 29.4 L30 33.6 L22.5 29.4 Z" fill={GOLD} stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
    </g>
  );
}

// The right hand, at the end of the right sleeve.
function Hand({ x, y }: { x: number; y: number }) {
  return <ellipse cx={x} cy={y} rx={1.7} ry={1.5} fill={SKIN} stroke={INK} strokeWidth={0.45} />;
}

// Heads are drawn at a base size and scaled up 20% about the chin, then
// lowered a touch, so the faces read clearly even on small cards.
const HEAD = 'translate(0 3) translate(30 20) scale(1.2) translate(-30 -20)';

function King({ p, suit }: { p: Palette; suit: Card['suit'] }) {
  return (
    <g>
      <Robe p={p} />
      {/* sceptre held in the right hand */}
      <path d="M41.6 46 L49.4 25.5" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M41.6 46 L49.4 25.5" stroke={GOLD} strokeWidth={1.25} strokeLinecap="round" />
      <circle cx={49.9} cy={24} r={2.1} fill={GOLD} stroke={INK} strokeWidth={0.5} />
      <path d="M49.9 21.2 L49.9 22.4 M49.3 21.8 L50.5 21.8" stroke={INK} strokeWidth={0.45} />
      <Hand x={44.2} y={40.6} />
      <g transform={HEAD}>
        <Face />
        {/* hair at the sides */}
        <path d="M24.2 12 C23 15 23.2 18 24.4 20 M35.8 12 C37 15 36.8 18 35.6 20" stroke={HAIR.K} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        {/* beard and moustache */}
        <path d="M24.4 18.5 C24.8 25.8 27.8 28.2 30 28.2 C32.2 28.2 35.2 25.8 35.6 18.5 C34.2 21.6 32.2 22.6 30 22.6 C27.8 22.6 25.8 21.6 24.4 18.5 Z" fill={HAIR.K} stroke={INK} strokeWidth={0.5} />
        <path d="M27 20.4 Q30 19.1 33 20.4 Q30 21.2 27 20.4 Z" fill={HAIR.K} stroke={INK} strokeWidth={0.35} />
        {/* crown */}
        <path d="M22.5 11.5 L23.4 5 L26.6 8.4 L30 3.4 L33.4 8.4 L36.6 5 L37.5 11.5 Z" fill={GOLD} stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
        <rect x={22.3} y={9.4} width={15.4} height={2.8} rx={0.6} fill={GOLD_LIGHT} stroke={INK} strokeWidth={0.5} />
        <circle cx={30} cy={10.8} r={0.95} fill={p.trim} />
        <circle cx={25.6} cy={10.8} r={0.7} fill={p.robe} />
        <circle cx={34.4} cy={10.8} r={0.7} fill={p.robe} />
        <circle cx={30} cy={3.6} r={0.85} fill={GOLD_LIGHT} stroke={INK} strokeWidth={0.3} />
      </g>
      <Emblem suit={suit} color={p.suit} x={13.2} y={38.2} />
    </g>
  );
}

function Queen({ p, suit }: { p: Palette; suit: Card['suit'] }) {
  return (
    <g>
      {/* long hair falls behind the shoulders */}
      <g transform={HEAD}>
        <path d="M23.6 11 C20.6 18 21.6 25 19.8 30 L25 29.5 C24.2 24 24.4 18 25.6 12.5 Z" fill={HAIR.Q} stroke={INK} strokeWidth={0.4} />
        <path d="M36.4 11 C39.4 18 38.4 25 40.2 30 L35 29.5 C35.8 24 35.6 18 34.4 12.5 Z" fill={HAIR.Q} stroke={INK} strokeWidth={0.4} />
      </g>
      <Robe p={p} />
      {/* a rose held in the right hand */}
      <path d="M43.6 41.5 C45 37.6 46.4 34.4 48 31.6" stroke="#2f6b3a" strokeWidth={0.9} fill="none" />
      <path d="M46.2 36 C44.2 35.4 43.4 36.8 44.2 37.8 C45.1 38.1 46 37.3 46.2 36 Z" fill="#2f6b3a" />
      <circle cx={48.4} cy={30.4} r={2.5} fill={p.trim === RED ? RED : '#c23a4f'} stroke={INK} strokeWidth={0.45} />
      <path d="M47.1 30.4 Q48.4 28.8 49.7 30.4 Q48.4 31.9 47.1 30.4 Z" fill="none" stroke={INK} strokeWidth={0.35} opacity={0.7} />
      <Hand x={44.2} y={40.6} />
      <g transform={HEAD}>
        <Face />
        {/* fringe */}
        <path d="M24.2 13 C25.5 9.8 34.5 9.8 35.8 13 C33.5 11.4 26.5 11.4 24.2 13 Z" fill={HAIR.Q} stroke={INK} strokeWidth={0.35} />
        {/* tiara */}
        <path d="M24 10.4 C26 7.6 34 7.6 36 10.4 L35.2 11.4 C33.2 9.6 26.8 9.6 24.8 11.4 Z" fill={GOLD} stroke={INK} strokeWidth={0.5} />
        <path d="M26.3 8.9 L27.2 6.6 L28.2 8.5 M31.8 8.5 L32.8 6.6 L33.7 8.9" stroke={INK} strokeWidth={0.4} fill={GOLD_LIGHT} strokeLinejoin="round" />
        <path d="M28.6 8.3 L30 5 L31.4 8.3 Z" fill={GOLD_LIGHT} stroke={INK} strokeWidth={0.4} strokeLinejoin="round" />
        <circle cx={30} cy={7.7} r={0.85} fill={p.trim} />
        {/* earrings */}
        <circle cx={24.2} cy={19.6} r={0.7} fill={GOLD_LIGHT} stroke={INK} strokeWidth={0.25} />
        <circle cx={35.8} cy={19.6} r={0.7} fill={GOLD_LIGHT} stroke={INK} strokeWidth={0.25} />
      </g>
      <Emblem suit={suit} color={p.suit} x={13.2} y={38.2} />
    </g>
  );
}

function Jack({ p, suit }: { p: Palette; suit: Card['suit'] }) {
  return (
    <g>
      <Robe p={p} />
      {/* a short staff held in the right hand */}
      <path d="M44.2 46 L46.6 28" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M44.2 46 L46.6 28" stroke="#8a5a2b" strokeWidth={1} strokeLinecap="round" />
      <path d="M46.6 28 L45.4 24.6 L47.9 25.2 Z" fill={GOLD_LIGHT} stroke={INK} strokeWidth={0.4} strokeLinejoin="round" />
      <Hand x={44.6} y={40.6} />
      <g transform={HEAD}>
        <Face />
        {/* short curled hair */}
        <path d="M24 12.4 C23 14.8 23.3 17.6 24.4 19.4 M36 12.4 C37 14.8 36.7 17.6 35.6 19.4" stroke={HAIR.J} strokeWidth={1.9} fill="none" strokeLinecap="round" />
        {/* feather */}
        <path d="M35.4 9.2 C39 5.4 42.6 3.8 45.8 3 C43.6 5.8 40.8 8 37 10.6 Z" fill={GOLD} stroke={INK} strokeWidth={0.45} strokeLinejoin="round" />
        <path d="M37 9.6 C39.8 7 42.4 5.4 44.8 4" stroke={INK} strokeWidth={0.3} fill="none" opacity={0.6} />
        {/* cap */}
        <path d="M22.6 12.4 C21.8 6.4 38.2 5.8 38.6 12 L37 12.8 C33.4 10.6 26.6 10.6 23.6 12.8 Z" fill={p.trim} stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
        <path d="M23.2 11.6 C27 9.6 33 9.6 37.6 11.2" stroke={GOLD_LIGHT} strokeWidth={0.9} fill="none" />
      </g>
      <Emblem suit={suit} color={p.suit} x={13.2} y={38.2} />
    </g>
  );
}

const FIGURE = { K: King, Q: Queen, J: Jack } as const;

export function CourtArt({ card }: { card: Card }) {
  if (card.rank !== 'K' && card.rank !== 'Q' && card.rank !== 'J') return null;
  const p = paletteFor(card.suit);
  const Figure = FIGURE[card.rank];
  return (
    <svg className="court-art" viewBox="0 0 60 92" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect x={0.6} y={0.6} width={58.8} height={90.8} rx={3.2} fill={IVORY} stroke={GOLD} strokeWidth={1.2} />
      <clipPath id={`court-clip-${card.rank}${card.suit}`}>
        <rect x={1.8} y={1.8} width={56.4} height={88.4} rx={2.4} />
      </clipPath>
      <g clipPath={`url(#court-clip-${card.rank}${card.suit})`}>
        {/* a soft gold halo behind each head */}
        <circle cx={30} cy={20} r={15} fill={GOLD_LIGHT} opacity={0.22} />
        <circle cx={30} cy={72} r={15} fill={GOLD_LIGHT} opacity={0.22} />
        <Figure p={p} suit={card.suit} />
        <g transform="rotate(180 30 46)">
          <Figure p={p} suit={card.suit} />
        </g>
      </g>
      {/* divider between the two halves */}
      <path d="M2 46 L58 46" stroke={GOLD} strokeWidth={0.9} />
      <CentreSuit suit={card.suit} color={p.suit} />
      <rect x={1.8} y={1.8} width={56.4} height={88.4} rx={2.4} fill="none" stroke={p.suit} strokeWidth={0.5} opacity={0.55} />
    </svg>
  );
}
