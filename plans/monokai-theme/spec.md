# Feature: Monokai Pro Theme

## Blueprint

### Context

The original dark theme used custom purple-tinted colors. This PBI swaps all CSS variable values in `theme.css` to the Monokai Pro palette for a more polished, recognizable aesthetic. No variable names change — only values.

### Architecture

- **Source file:** `src/renderer/theme.css`
- **Secondary:** `src/renderer/index.html` (hardcoded background)
- **Scope:** Pure CSS value swap; no logic changes

**Key Palette:**
- Surface: `#2d2a2e` (primary), `#353236` (card), `#221f22` (inset)
- Text: `#fcfcfa` (primary)
- Status: green `#a9dc76`, blue `#78dce8`, pink `#ff6188`, yellow `#ffd866`
- Accent: purple `#ab9df2`, orange `#fc9867`

### Anti-Patterns

- **Changing variable names** — Only values should change; all consumers reference the same custom property names.
- **Hardcoded colors in components** — All colors must flow through CSS variables.

## Contract

### Definition of Done

- [ ] All `:root` CSS variable values updated to Monokai Pro palette
- [ ] `index.html` background matches `--color-surface-primary`
- [ ] Existing tests pass (no color assertions in test suite)
- [ ] Visual check: all views render correctly with new palette

### Scenarios

**Scenario: Theme applied globally**
- Given: The app loads with `theme.css`
- When: Any view renders
- Then: All colors come from Monokai Pro palette via CSS variables
