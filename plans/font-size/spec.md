# Feature: Font Size Preference

## Blueprint

### Context

Users want to adjust the UI font size. This PBI adds a `--font-size-base` CSS variable, anchors `:root { font-size }` to it, and provides a Small/Medium/Large toggle in SettingsPanel that persists via the settings IPC channel.

### Architecture

- **CSS:** `src/renderer/theme.css` — adds `--font-size-base: 14px` and `font-size: var(--font-size-base)` to `:root`
- **App.svelte:** Loads settings on mount, applies font size, provides `partial:setFontSize` and `partial:getFontSize` contexts
- **SettingsPanel:** Font size toggle buttons (Small=12px, Medium=14px, Large=16px) that apply instantly
- **Graph.svelte:** Converts hardcoded `10px` to `0.714rem`

**Design Decisions:**
- Most components already use `rem` units, so they scale automatically
- Only Graph.svelte had a hardcoded `px` font-size that needed conversion
- Changes apply instantly (no Save/Cancel) for better UX
- Persisted via `api.setSettings({ fontSize })` on every toggle

### Anti-Patterns

- **Using px throughout** — All component font sizes should use `rem` so they scale with the base.
- **Requiring a Save button** — Font size changes should apply instantly for immediate feedback.

## Contract

### Definition of Done

- [ ] `--font-size-base: 14px` added to `:root` in `theme.css`
- [ ] `:root { font-size: var(--font-size-base) }` applied
- [ ] App.svelte loads font size from settings on mount
- [ ] `partial:setFontSize` and `partial:getFontSize` contexts provided
- [ ] SettingsPanel shows Small/Medium/Large toggle buttons
- [ ] Font size persists across app restarts
- [ ] Graph.svelte node labels use `rem` not `px`
- [ ] All tests pass

### Scenarios

**Scenario: Change font size to Large**
- Given: Default font size (14px)
- When: User opens Settings and clicks "Large"
- Then: All text scales up to 16px base; setting persists

**Scenario: Font size loads on restart**
- Given: User previously set font size to "Small" (12px)
- When: App launches
- Then: Font size is applied as 12px on mount
