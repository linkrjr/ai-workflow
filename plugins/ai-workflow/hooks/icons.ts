// Icons are PNGs in assets/icons, rendered from the SVG beside each:
//   rsvg-convert -w 120 -h 120 <agent>.svg -o <agent>.png   (team: -w 240 -h 240)
// A terminal that cannot draw images shows the Nerd Font glyph instead.

export type Icon = { file: string; glyph: string }

// 12 columns x 6 rows in the header; 6 x 3 beside an agent's box. Cells are about
// twice as tall as wide, so both boxes are near square.
export const TEAM_ICON_SIZE = { columns: 12, rows: 6 }
export const AGENT_ICON_SIZE = { columns: 6, rows: 3 }

export const TEAM_ICON: Icon = { file: 'team.png', glyph: '' } // nf-fa-users

// One per agent of this plugin, keyed by its name (`ai-workflow:<name>` as a subagent type).
export const AGENT_ICONS: Record<string, Icon> = {
  'ticket-reviewer': { file: 'ticket-reviewer.png', glyph: '' }, // nf-fa-bug
  designer: { file: 'designer.png', glyph: '' }, // nf-fa-paint_brush
  'backend-engineer': { file: 'backend-engineer.png', glyph: '' }, // nf-fa-server
  'frontend-engineer': { file: 'frontend-engineer.png', glyph: '' }, // nf-cod-browser
  'code-reviewer': { file: 'code-reviewer.png', glyph: '' }, // nf-fa-search
  'qa-tester': { file: 'qa-tester.png', glyph: '' }, // nf-fa-flask
  writer: { file: 'writer.png', glyph: '' }, // nf-fa-pencil
}
