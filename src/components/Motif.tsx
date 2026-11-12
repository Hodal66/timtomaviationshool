import { themeOf } from "@/lib/catalogue";

/** Original aviation artwork per subject area. Illustrations, not photographs. */
export function Motif({ theme }: { theme: string }) {
  const a = themeOf(theme).accent, W = { fill: "none", stroke: a, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const soft = { fill: a, opacity: 0.18 };
  let g: React.ReactNode;
  switch (theme) {
    case "cabin-crew": g = (<><path d="M30 190 H220" {...W} />{[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={46 + c * 98} y={36 + r * 50} width={58} height={40} rx={14} {...soft} stroke={a} strokeWidth={2} />))}<path d="M122 36 V176" {...W} strokeDasharray="3 8" /></>); break;
    case "safety-security": g = (<><path d="M125 20 L205 52 V116 C205 160 170 186 125 202 C80 186 45 160 45 116 V52 Z" {...W} /><path d="M125 20 L205 52 V116 C205 160 170 186 125 202Z" {...soft} stroke="none" /><path d="M92 112 L116 136 L162 84" {...W} strokeWidth={6} /></>); break;
    case "cargo": g = (<><path d="M20 196 H230" {...W} />{[[34, 148], [96, 148], [158, 148], [64, 98], [126, 98], [96, 48]].map(([x, y], i) => <rect key={i} x={x} y={y} width={56} height={46} rx={4} {...soft} stroke={a} strokeWidth={2} />)}</>); break;
    case "tourism": g = (<><circle cx={125} cy={110} r={80} {...W} /><circle cx={125} cy={110} r={80} {...soft} stroke="none" /><ellipse cx={125} cy={110} rx={34} ry={80} {...W} /><path d="M45 110 H205 M60 70 H190 M60 150 H190" {...W} /></>); break;
    case "airport-ops": g = (<><path d="M20 200 H230" {...W} />{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${34 + i * 46} 200 L125 40`} {...W} opacity={0.35 + i * 0.12} />)}<path d="M104 126 h42 M92 156 h66" {...W} /></>); break;
    case "dispatch": g = (<><circle cx={125} cy={112} r={86} {...W} /><circle cx={125} cy={112} r={56} {...W} /><circle cx={125} cy={112} r={26} {...W} /><path d="M125 112 L192 58" {...W} strokeWidth={4} /><circle cx={172} cy={74} r={7} fill={a} /></>); break;
    case "ticketing": g = (<><path d="M30 66 H208 a18 18 0 0 0 0 36 a18 18 0 0 0 0 36 H30 Z" {...W} /><path d="M30 66 H208 a18 18 0 0 0 0 36 a18 18 0 0 0 0 36 H30 Z" {...soft} stroke="none" /><path d="M84 66 V138" {...W} strokeDasharray="4 7" /><path d="M110 92 H176 M110 112 H156" {...W} /></>); break;
    case "airport-airline": g = (<><path d="M30 196 H220" {...W} /><path d="M40 112 L125 52 L210 112 V196 H40 Z" {...soft} stroke={a} strokeWidth={2.2} /><path d="M72 196 V138 M125 196 V138 M178 196 V138" {...W} /></>); break;
    case "aviation-management": g = (<><path d="M30 196 H224" {...W} /><path d="M34 176 L92 118 L132 150 L212 56" {...W} strokeWidth={4} /><path d="M212 56 L182 58 M212 56 L210 86" {...W} strokeWidth={4} />{[60, 100, 140, 180].map((x, i) => <rect key={x} x={x} y={196 - 20 - i * 14} width={22} height={20 + i * 14} rx={3} {...soft} />)}</>); break;
    case "ict": g = (<><rect x={46} y={52} width={158} height={106} rx={10} {...W} /><rect x={46} y={52} width={158} height={106} rx={10} {...soft} stroke="none" /><path d="M82 94 L104 114 L82 134 M120 136 H164" {...W} strokeWidth={4} /><path d="M92 188 H158" {...W} /></>); break;
    default: g = (<path d="M28 150 L125 36 L222 150 L125 120 Z" {...W} strokeWidth={3} />);
  }
  return (<svg viewBox="0 0 250 220" role="img" aria-label={`${themeOf(theme).name} illustration`}>{g}</svg>);
}
