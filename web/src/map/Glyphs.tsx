// 24x24 stroke icons drawn inside the SVG map (no external art assets).
type P = { size?: number; color: string; x?: number; y?: number };

function Icon({ size = 18, color, x = 0, y = 0, children }: P & { children: React.ReactNode }) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

export const EyeGlyph = (p: P) => (
  <Icon {...p}>
    <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const BoltGlyph = (p: P) => (
  <Icon {...p}>
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </Icon>
);

export const KeyGlyph = (p: P) => (
  <Icon {...p}>
    <path d="M2.59 17.41A2 2 0 0 0 2 18.83V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.17a2 2 0 0 0 1.42-.59l.81-.81a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r=".5" />
  </Icon>
);

export const LockGlyph = ({ open, ...p }: P & { open: boolean }) => (
  <Icon {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d={open ? "M7 11V7a5 5 0 0 1 9.9-1" : "M7 11V7a5 5 0 0 1 10 0v4"} />
  </Icon>
);

export const PortraitGlyph = (p: P) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 19c1-3 3-4 5-4s4 1 5 4" />
  </Icon>
);

export const LedgerGlyph = (p: P) => (
  <Icon {...p}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    <path d="M9 7h7M9 11h5" />
  </Icon>
);

export const ShelfGlyph = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="2" width="18" height="20" rx="1" />
    <path d="M3 9h18M3 16h18M7 4v5M10 4v5M15 11v5M18 11v5" />
  </Icon>
);

export const GLYPHS = { eye: EyeGlyph, bolt: BoltGlyph, key: KeyGlyph } as const;
