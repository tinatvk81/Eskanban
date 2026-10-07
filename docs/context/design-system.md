# Design system — color tokens

Brand accent is GoldenRod `#DAA520` (trust, value). Contrast ratios below are WCAG 2.x, measured.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#14141F` | `#F7F5F0` |
| `--surface` | `#1E1E2E` | `#FFFFFF` |
| `--text` | `#E8E6E3` | `#1F1F2B` |
| `--accent` (fills) | `#DAA520` | `#DAA520` |
| `--on-accent` | `#14141F` | `#14141F` |
| `--accent-hover` | `#B8860B` | `#B8860B` |
| `--accent-text` (gold text/links) | `#DAA520` | `#8A6508` |
| `--success` | `#34D399` | `#15803D` |

## Contrast results
| Pair | Ratio | Verdict |
|---|---|---|
| Dark: gold on bg | 8.16 | pass |
| Dark: text on bg | 14.67 | pass |
| Dark: success on bg | 9.50 | pass |
| Both: `#14141F` on gold button | 8.16 | pass |
| Light: GoldenRod text on bg | 2.05 | **fail** — never use as text |
| Light: DarkGoldenRod `#B8860B` text on bg | 2.99 | **fail** for body text |
| Light: `#8A6508` text on bg | 4.88 | pass |
| Light: text on bg | 14.95 | pass |
| Light: success `#15803D` on bg | 4.60 | pass |

## Rules
- Gold is a **fill** in light theme (buttons, badges with dark text); use `--accent-text` for gold-colored text.
- Never rely on color alone for status; pair with an icon or label.
- Persian UI font must support Persian digits and render well at 14–16px (decide in Phase 1).
