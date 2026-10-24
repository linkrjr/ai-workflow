// Pixel-art icons drawn as terminal cells: one character per pixel ('.' is transparent),
// two pixels per cell (a half block, its colors the top and bottom pixel).

export const ICON_SIZE = 12
export const AGENT_ICON_SIZE = 6

const PALETTE: Record<string, number> = {
  Y: 0xfde047, // gold
  G: 0x4ade80, // green
  g: 0x16a34a, // dark green
  w: 0x94a3b8, // grey
  C: 0x22d3ee, // cyan
  c: 0x0891b2, // dark cyan
  O: 0xfacc15, // yellow
  o: 0xca8a04, // dark yellow
  W: 0xf8fafc, // white
  K: 0x475569, // slate
  R: 0xef4444, // red
  r: 0xb91c1c, // dark red
  B: 0x60a5fa, // blue
  b: 0x2563eb, // dark blue
  P: 0xc084fc, // purple
  T: 0xd6a46c, // tan
}

const DEFAULT_COLOR = 0x01000000

// 12x12: the leader and the agents under it.
export const TEAM_ICON = [
  '...Y.YY.Y...',
  '...YYYYYY...',
  '...gGGGGg...',
  '...gGGGGg...',
  '....gggg....',
  '...w.ww.w...',
  '..w..ww..w..',
  '.w...ww...w.',
  '.w...ww...w.',
  'cCc.oOOo.cCc',
  'cCc.oOOo.cCc',
  'ccc.oooo.ccc',
]

// 6x6, one per agent of this plugin, keyed by its name (`ai-workflow:<name>` as a subagent type).
export const AGENT_ICONS: Record<string, string[]> = {
  'ticket-reviewer': [
    'K.KK.K',
    '.rRRr.',
    'rRKKRr',
    'KRKKRK',
    'rRKKRr',
    '.rrrr.',
  ],
  'designer': [
    '.TTTT.',
    'TRTTBT',
    'TTT.TT',
    'TYT.TT',
    'TTTTPT',
    '.TTTT.',
  ],
  'backend-engineer': [
    'bbbbbb',
    'bwwbGb',
    'bbbbbb',
    'bwwbGb',
    'bbbbbb',
    '.K..K.',
  ],
  'frontend-engineer': [
    'wwwwww',
    'wRwGww',
    'wWWWWw',
    'wBBWWw',
    'wWWBBw',
    'wwwwww',
  ],
  'code-reviewer': [
    '.BBB..',
    'B..GB.',
    'BGG.B.',
    '.BBB..',
    '....T.',
    '.....T',
  ],
  'qa-tester': [
    '.wwww.',
    '..ww..',
    '.wPPw.',
    '.wPWw.',
    'wPPPPw',
    'wwwwww',
  ],
  'writer': [
    '....RR',
    '...wRr',
    '..OOw.',
    '.OOo..',
    '.To...',
    'K.....',
  ],
}

// A Raster's `cells`: [codePoint, foreground, background] per cell, little-endian u32, base64.
export const rasterCells = (rows: string[]) => {
  const words: number[] = []
  for (let y = 0; y < rows.length; y += 2) {
    for (let x = 0; x < (rows[0]?.length ?? 0); x++) {
      const top = PALETTE[rows[y]?.[x] ?? '.']
      const bottom = PALETTE[rows[y + 1]?.[x] ?? '.']
      // A transparent pixel keeps the terminal's background, so it can never be a foreground.
      if (top === undefined && bottom === undefined) words.push(0x20, DEFAULT_COLOR, DEFAULT_COLOR)
      else if (top === undefined) words.push(0x2584, bottom ?? DEFAULT_COLOR, DEFAULT_COLOR)
      else words.push(0x2580, top, bottom ?? DEFAULT_COLOR)
    }
  }
  // Uint8Array.prototype.toBase64 is in the runtime, not yet in TypeScript's lib.
  const bytes = new Uint8Array(Uint32Array.from(words).buffer) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}
