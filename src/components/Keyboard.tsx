export interface KeyMark {
  label: string;
  hand: 'L' | 'R';
  common?: boolean;
}

interface Props {
  low?: number;
  high?: number;
  marks: Map<number, KeyMark>;
  held: Set<number>;
  /** Color held notes green/red against the marks; otherwise held notes show neutrally. */
  judge: boolean;
  onKey?: (midi: number) => void;
}

const BLACK = new Set([1, 3, 6, 8, 10]);
const W = 22;
const H = 124;
const BW = 14;
const BH = 78;

export function Keyboard({ low = 36, high = 96, marks, held, judge, onKey }: Props) {
  const whites: number[] = [];
  const blacks: { midi: number; x: number }[] = [];
  for (let m = low; m <= high; m++) {
    if (BLACK.has(m % 12)) blacks.push({ midi: m, x: whites.length * W - BW / 2 });
    else whites.push(m);
  }

  const cls = (m: number) => {
    const mark = marks.get(m);
    if (held.has(m)) return judge ? (mark ? 'k-ok' : 'k-bad') : 'k-held';
    if (mark) return mark.hand === 'L' ? 'k-lh' : 'k-rh';
    return '';
  };

  const label = (m: number, x: number, y: number) => {
    const mark = marks.get(m);
    if (!mark) return null;
    return (
      <g className="k-label" pointerEvents="none">
        {mark.common && <circle cx={x} cy={y - 18} r={3} className="k-common" />}
        <text x={x} y={y} textAnchor="middle">
          {mark.label}
        </text>
      </g>
    );
  };

  return (
    <svg className="keyboard" viewBox={`0 0 ${whites.length * W} ${H}`} role="img" aria-label="Piano keyboard">
      {whites.map((m, i) => (
        <g key={m} onClick={() => onKey?.(m)}>
          <rect x={i * W} y={0} width={W} height={H} rx={3} className={`k-white ${cls(m)}`} />
          {m % 12 === 0 && !marks.has(m) && (
            <text x={i * W + W / 2} y={H - 8} textAnchor="middle" className="k-c">
              {m === 60 ? 'C4' : 'C'}
            </text>
          )}
          {label(m, i * W + W / 2, H - 9)}
        </g>
      ))}
      {blacks.map(({ midi, x }) => (
        <g key={midi} onClick={() => onKey?.(midi)}>
          <rect x={x} y={0} width={BW} height={BH} rx={2} className={`k-black ${cls(midi)}`} />
          {label(midi, x + BW / 2, BH - 8)}
        </g>
      ))}
    </svg>
  );
}
