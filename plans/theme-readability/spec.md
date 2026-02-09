# Feature: Theme Readability — Contrast & Visibility Pass

## Blueprint

### Context

The Monokai Pro theme (PBI-073) shipped a cohesive palette but several secondary
text and border tokens have insufficient contrast against their backgrounds. The
result is hard-to-read metadata, near-invisible placeholders, and card surfaces
that don't visually separate from the background. This spec addresses a targeted
readability pass on the existing CSS custom properties — no variable names change,
no new variables are introduced, and no component logic is touched.

**Root cause:** The dim/hint/placeholder tiers were tuned for aesthetics rather
than WCAG contrast ratios. Borders and subtle-status fills are too close to the
surface colors to provide meaningful separation.

### Problems (audited against `theme.css` tokens)

| Token | Current | Bg Context | Ratio | WCAG AA (4.5:1) |
|---|---|---|---|---|
| `--color-text-muted` | `#939293` | `#2d2a2e` | ~4.0:1 | FAIL (normal text) |
| `--color-text-dim` | `#727072` | `#2d2a2e` | ~3.0:1 | FAIL |
| `--color-text-hint` | `#5b595c` | `#2d2a2e` | ~2.2:1 | FAIL |
| `--color-text-placeholder` | `#4a484b` | `#353236` | ~1.5:1 | FAIL |
| `--color-text-done` | `#939293` | `#2d2a2e` | ~4.0:1 | FAIL (normal text) |
| `--color-border-primary` | `#49474a` | `#2d2a2e` | — | Barely visible |
| `--color-surface-card` | `#353236` | `#2d2a2e` | — | ~5% luminance gap |
| Status subtle fills | `#2a3a2a` etc. | `#353236` | — | No visible distinction |

### Architecture

- **Source file:** `src/renderer/theme.css` (only file modified)
- **Secondary:** `src/renderer/index.html` (hardcoded `background` must track surface)
- **Scope:** Pure CSS value swap; no component logic, no variable renames
- **Approach:** Lighten the dim/hint/placeholder tiers to meet WCAG AA (4.5:1
  minimum for normal text, 3:1 for large text/UI components). Increase surface
  differentiation between card and primary. Strengthen borders. Increase
  saturation of status-subtle fills.

**Proposed new values (approximate — exact values to be tuned during
implementation with a contrast checker):**

| Token | Current | Proposed | Target Ratio |
|---|---|---|---|
| `--color-text-muted` | `#939293` | `#a8a7a8` | >= 5.0:1 |
| `--color-text-dim` | `#727072` | `#8a888b` | >= 4.5:1 |
| `--color-text-hint` | `#5b595c` | `#757375` | >= 3.5:1 (UI components) |
| `--color-text-placeholder` | `#4a484b` | `#636063` | >= 3.0:1 (UI components) |
| `--color-text-done` | `#939293` | `#a8a7a8` | >= 5.0:1 |
| `--color-border-primary` | `#49474a` | `#5a585c` | Visible against both surfaces |
| `--color-border-secondary` | `#5b595c` | `#6b696d` | Visible hover differentiation |
| `--color-surface-card` | `#353236` | `#3a373c` | Increased lift from primary |
| `--color-surface-elevated` | `#393536` | `#403c42` | Clear differentiation |
| `--color-surface-elevated-hover` | `#433f44` | `#4a464c` | Visible hover state |
| Status subtle fills | `#2a3a2a` etc. | Increased saturation | Visible tint on cards |

### Anti-Patterns

- **Changing variable names** — Only values change; all consumers reference the
  same custom property names.
- **Hardcoded colors in components** — All colors must flow through CSS variables.
  This spec intentionally does not add any new inline colors.
- **Over-brightening** — The palette must still feel like a dark theme. Targets
  are WCAG minimums, not maximums.
- **Touching component logic** — This is purely a CSS value pass. If component
  markup needs fixing, that belongs in a separate PBI.

### Dependency Notes

- This work builds on PBI-073 (Monokai Pro theme). No blockers.
- Components that use `getComputedStyle()` for runtime colors (Graph.svelte
  `nodeColor()`) will automatically pick up new values via CSS variables.

## Contract

### Definition of Done

- [ ] All `:root` CSS variable values updated per the table above (exact values
      may be tuned during implementation)
- [ ] `index.html` background matches updated `--color-surface-primary` (or
      remains `#2d2a2e` if that token is unchanged)
- [ ] WCAG AA contrast ratios met for all text tokens against their typical
      backgrounds (verified with a contrast checker)
- [ ] Borders are visibly distinct from surfaces in all views
- [ ] Card surfaces visibly lift from the background
- [ ] Status-subtle fills show a visible tint on card backgrounds
- [ ] Existing tests pass (no color assertions in test suite)
- [ ] Visual check: all views remain cohesive and "dark theme" feeling

### Out of Scope

- Light theme / theme switching infrastructure
- New CSS variables or variable renames
- Component markup changes
- Accessibility beyond color contrast (focus rings, ARIA — covered by other PBIs)

### Scenarios

**Scenario: Muted text is readable**
- Given: A task card showing metadata (ID, deps) in `--color-text-dim`
- When: The user views the Kanban board
- Then: Metadata text has >= 4.5:1 contrast against `--color-surface-card`

**Scenario: Placeholder text is perceptible**
- Given: An empty input field with placeholder text in `--color-text-placeholder`
- When: The user opens the task detail panel
- Then: Placeholder text is clearly visible, >= 3.0:1 contrast

**Scenario: Cards separate from background**
- Given: The Kanban view with multiple task cards
- When: Rendered on screen
- Then: Cards visibly "float" above the background; borders are perceptible

**Scenario: Status subtle fills distinguish columns**
- Given: Task cards in different status columns (done, ready, blocked, in-progress)
- When: The user views the Kanban board
- Then: The subtle background tints on cards/borders are perceptibly different per status
