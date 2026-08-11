// A fixed, full-viewport satin/velvet cloth backdrop, modeled on an actual
// draped-satin reference photo: curved folds with a bright, narrow
// highlight along one edge of each ridge and a broad, dark shadow in the
// trough next to it.
//
// Each fold is one smooth bezier curve drawn three times at increasing
// width and, for the base/highlight passes, offset a few px toward the
// light source -- a standard vector-illustration trick for rendering a
// rounded 3D tube from flat strokes.
const FOLD_PATHS = [
  "M -100,180 C 250,50 450,320 750,180 C 1000,60 1300,250 1750,120",
  "M -100,500 C 200,650 350,380 600,480 C 850,580 1000,350 1300,450 C 1500,520 1650,420 1800,500",
  "M 380,720 C 540,560 500,340 710,380 C 920,420 860,610 650,660 C 500,695 460,760 610,790",
  "M -100,760 C 300,660 500,860 900,730 C 1200,630 1400,790 1800,710",
  "M 1100,-50 C 1040,150 1260,200 1300,390 C 1340,510 1190,555 1140,660",
  "M -50,60 C 300,260 600,160 900,410 C 1150,610 1400,510 1700,760",
];

// Offset toward the upper-left, consistent with a single light source --
// keeps every ridge's highlight on the same side, like real directional
// light hitting the cloth.
const HIGHLIGHT_OFFSET = "-9,-13";
const BASE_OFFSET = "-4,-6";

function Fold({ d }: { d: string }) {
  return (
    <g>
      <path
        d={d}
        stroke="var(--velvet-shadow)"
        strokeWidth={130}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />
      <path
        d={d}
        stroke="var(--velvet-b)"
        strokeWidth={88}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
        transform={`translate(${BASE_OFFSET})`}
      />
      <path
        d={d}
        stroke="var(--velvet-glow-1)"
        strokeWidth={16}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
        transform={`translate(${HIGHLIGHT_OFFSET})`}
      />
    </g>
  );
}

export default function VelvetBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--velvet-a), var(--velvet-b) 45%, var(--velvet-a) 100%)",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        {FOLD_PATHS.map((d) => (
          <Fold key={d} d={d} />
        ))}
      </svg>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 50% at 12% 6%, var(--velvet-glow-2), transparent 55%)",
            "radial-gradient(ellipse 65% 50% at 85% 95%, var(--velvet-shadow-soft), transparent 60%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
