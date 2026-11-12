import { themeOf } from "@/lib/catalogue";

/** Original vector artwork per category. These are illustrations, not photographs. */
export function Motif({ theme }: { theme: string }) {
  const t = themeOf(theme); const a = t.accent;
  const W = { fill: "none", stroke: a, strokeWidth: 2, strokeLinecap: "round" as const, opacity: 0.9 };
  let g: React.ReactNode;
  switch (theme) {
    case "cabin-crew": g = (<>{[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={30 + c * 44 + (c > 1 ? 24 : 0)} y={50 + r * 52} width={32} height={38} rx={10} fill={a} opacity={0.25 + r * 0.2} />))}<path d="M20 190 H230" {...W} /></>); break;
    case "safety-security": g = (<><path d="M125 25 L205 55 V115 C205 160 170 185 125 200 C80 185 45 160 45 115 V55 Z" {...W} /><path d="M92 112 L116 136 L162 84" {...W} strokeWidth={6} /></>); break;
    case "cargo": g = (<>{[[30, 140], [90, 140], [150, 140], [60, 90], [120, 90], [90, 40]].map(([x, y], i) => <rect key={i} x={x} y={y} width={56} height={46} fill={a} opacity={0.2 + (i % 3) * 0.2} stroke={a} />)}<path d="M20 200 H230" {...W} /></>); break;
    case "tourism": g = (<><circle cx={125} cy={110} r={78} {...W} /><ellipse cx={125} cy={110} rx={34} ry={78} {...W} /><path d="M47 110 H203 M62 70 H188 M62 150 H188" {...W} /></>); break;
    case "airport-ops": g = (<>{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${40 + i * 40} 200 L${125} 40`} {...W} opacity={0.4 + i * 0.1} />)}<path d="M20 200 H230" {...W} /></>); break;
    case "dispatch": g = (<><circle cx={125} cy={115} r={85} {...W} /><circle cx={125} cy={115} r={55} {...W} /><circle cx={125} cy={115} r={25} {...W} /><path d="M125 115 L190 60" {...W} strokeWidth={4} /><circle cx={170} cy={80} r={6} fill={a} /></>); break;
    case "ticketing": g = (<><path d="M30 70 H200 a16 16 0 0 0 0 32 a16 16 0 0 0 0 32 H30 Z" transform="translate(0 0)" {...W} /><path d="M80 70 V134" {...W} strokeDasharray="4 6" /><path d="M105 95 H170 M105 112 H150" {...W} /></>); break;
    case "airport-airline": g = (<><rect x={40} y={110} width={170} height={70} rx={6} {...W} /><path d="M40 110 L125 50 L210 110" {...W} /><path d="M70 180 V135 M125 180 V135 M180 180 V135" {...W} /></>); break;
    case "aviation-management": g = (<><path d="M30 190 L90 120 L130 150 L210 50" {...W} strokeWidth={4} /><path d="M210 50 L180 52 M210 50 L208 80" {...W} strokeWidth={4} /><path d="M30 200 H230" {...W} /></>); break;
    case "ict": g = (<><rect x={50} y={60} width={150} height={100} rx={8} {...W} /><path d="M85 100 L105 118 L85 136 M120 138 H160" {...W} strokeWidth={4} /><path d="M90 185 H160" {...W} /></>); break;
    default: g = (<path d="M30 150 L125 40 L220 150 L125 120 Z" {...W} strokeWidth={3} />);
  }
  return (<svg viewBox="0 0 250 220" role="img" aria-label={`${t.name} illustration`} style={{ width: "100%", height: "auto" }}>{g}</svg>);
}
