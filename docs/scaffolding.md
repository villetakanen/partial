# Project Partial: Scaffolding Guide
## For Development Agents & Contributors

---

## 1. Overview

This document provides step-by-step instructions for scaffolding the Project Partial codebase. Follow this guide to set up a consistent, maintainable development environment.

**Target Stack:**
- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5.x (strict mode)
- **Desktop Shell:** Electron
- **UI Framework:** Svelte 5
- **Visualization:** D3.js
- **Linting/Formatting:** Biome
- **Git Hooks:** Lefthook
- **Commit Standard:** Conventional Commits
- **Repository:** GitHub

---

## 2. Repository Setup

### Initialize GitHub Repository

```bash
# Create repo on GitHub first, then:
git clone git@github.com:YOUR_ORG/partial.git
cd partial
```

### Repository Structure

```
partial/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── plans/                # Living specs (feature-level source of truth)
│   └── plan-parser/
│       └── spec.md
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts
│   │   ├── watcher.ts  # File watcher (chokidar)
│   │   └── parser.ts   # YAML parser
│   ├── renderer/       # Electron renderer (Svelte UI)
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── App.svelte
│   │   ├── views/
│   │   │   ├── Gantt.svelte
│   │   │   ├── Kanban.svelte
│   │   │   └── Graph.svelte
│   │   └── components/
│   │       └── TaskCard.svelte
│   ├── shared/         # Shared types & utilities
│   │   ├── types.ts    # .plan schema types
│   │   └── dag.ts      # DAG logic
│   └── cli/            # CLI tool (partial)
│       └── index.ts
├── tests/
├── docs/
├── AGENTS.md             # Agent context file (single source of truth)
├── CLAUDE.md             # Symlink → AGENTS.md (for Claude Code)
├── biome.json
├── lefthook.yml
├── package.json
├── tsconfig.json
├── electron-builder.json
└── README.md
```

---

## 3. Project Initialization

### Step 1: Initialize Package

```bash
npm init -y
```

Update `package.json`:

```json
{
  "name": "partial",
  "version": "0.1.0",
  "description": "Agent-native project management via .plan files",
  "main": "dist/main/index.js",
  "bin": {
    "partial": "./dist/cli/index.js"
  },
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "check": "biome check .",
    "check:fix": "biome check --write .",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "prepare": "lefthook install"
  },
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": ["project-management", "plan", "dag", "electron", "ai-agent"],
  "license": "MIT"
}
```

### Step 2: Install Dependencies

```bash
# Core
npm install electron electron-vite vite

# TypeScript
npm install -D typescript @types/node

# UI Framework
npm install svelte
npm install -D @sveltejs/vite-plugin-svelte svelte-check

# Visualization
npm install d3
npm install -D @types/d3

# Parser & utilities
npm install yaml                    # YAML parsing
npm install chokidar                # File watching
npm install graphlib                # DAG operations
npm install zod                     # Schema validation

# Build & packaging
npm install -D electron-builder

# Dev tooling
npm install -D @biomejs/biome
npm install -D lefthook
npm install -D vitest @vitest/coverage-v8
```

---

## 4. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 5. Biome Configuration

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "ignore": ["dist/", "node_modules/", "*.plan"]
  }
}
```

---

## 6. Electron Builder Configuration

Create `electron-builder.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.partial.app",
  "productName": "Partial",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*"
  ],
  "mac": {
    "target": [
      { "target": "dmg", "arch": ["x64", "arm64"] },
      { "target": "zip", "arch": ["x64", "arm64"] }
    ],
    "category": "public.app-category.developer-tools",
    "icon": "build/icon.icns"
  },
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64"] },
      { "target": "portable", "arch": ["x64"] }
    ],
    "icon": "build/icon.ico"
  },
  "linux": {
    "target": [
      { "target": "AppImage", "arch": ["x64"] },
      { "target": "deb", "arch": ["x64"] },
      { "target": "rpm", "arch": ["x64"] }
    ],
    "category": "Development",
    "icon": "build/icons"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "publish": {
    "provider": "github",
    "releaseType": "release"
  }
}
```

Add build scripts to `package.json`:

```json
{
  "scripts": {
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:win": "electron-vite build && electron-builder --win",
    "build:linux": "electron-vite build && electron-builder --linux",
    "release": "electron-vite build && electron-builder --publish always"
  }
}
```

---

## 7. Lefthook Configuration

Create `lefthook.yml`:

```yaml
# https://github.com/evilmartians/lefthook

pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: "*.{js,ts,svelte,json}"
      run: npx biome check --staged --no-errors-on-unmatched
    biome-format:
      glob: "*.{js,ts,svelte,json}"
      run: npx biome format --staged --no-errors-on-unmatched

commit-msg:
  commands:
    conventional-commit:
      run: |
        commit_msg=$(cat {1})
        pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,72}"
        if ! echo "$commit_msg" | grep -Eq "$pattern"; then
          echo "❌ Commit message must follow Conventional Commits format:"
          echo "   <type>(<scope>): <description>"
          echo ""
          echo "   Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
          echo ""
          echo "   Your message: $commit_msg"
          exit 1
        fi

pre-push:
  parallel: true
  commands:
    test:
      run: npm test -- --run
    typecheck:
      run: npx tsc --noEmit
    svelte-check:
      run: npx svelte-check --threshold error
```

Initialize Lefthook:

```bash
npx lefthook install
```

---

## 8. Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting (no code change) |
| `refactor` | Code change that neither fixes nor adds |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `build` | Build system or dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance tasks |
| `revert` | Revert a previous commit |

### Scopes (Project-Specific)

| Scope | Description |
|-------|-------------|
| `parser` | YAML parsing, schema validation |
| `watcher` | File watching, change detection |
| `dag` | Dependency graph logic |
| `cli` | CLI tool (`partial` command) |
| `ui` | Electron renderer, views |
| `gantt` | Gantt view |
| `kanban` | Kanban view |
| `graph` | DAG visualization view |

### Examples

```bash
feat(parser): add support for needs_ss dependency type
fix(watcher): handle file rename events correctly
docs(readme): add installation instructions
refactor(dag): extract cycle detection to separate module
test(parser): add round-trip tests for unknown fields
```

---

## 9. GitHub Configuration

### CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Biome check
        run: npm run check

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test -- --run --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

  build:
    needs: check
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
```

### Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build & Package (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & Package (Windows)
        if: matrix.os == 'windows-latest'
        run: npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & Package (macOS)
        if: matrix.os == 'macos-latest'
        run: npm run build:mac
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: release/*
          retention-days: 5

      - name: Publish to GitHub Releases
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release/*.dmg
            release/*.zip
            release/*.exe
            release/*.AppImage
            release/*.deb
            release/*.rpm
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**To release:**
```bash
# Bump version, tag, and push
npm version patch  # or minor, major
git push --follow-tags
```

### Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Summary

<!-- Brief description of changes -->

## Type of Change

- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] docs: Documentation
- [ ] refactor: Code refactoring
- [ ] test: Tests
- [ ] chore: Maintenance

## Testing

<!-- How was this tested? -->

- [ ] Unit tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Follows Conventional Commits
- [ ] Biome check passes
- [ ] TypeScript compiles without errors
- [ ] Tests added/updated
```

---

## 10. Initial Files

### src/shared/types.ts

```typescript
/**
 * .plan file schema types (v1.0.0)
 */

export interface PlanFile {
  version: string
  project: string
  tasks: Task[]
  // Preserve unknown fields for forward compatibility
  [key: string]: unknown
}

export interface Task {
  id: string
  title: string
  done?: boolean
  needs?: string[]
  parent?: string
  // Preserve unknown fields
  [key: string]: unknown
}

export type DependencyType = 'fs' | 'ss' | 'ff' | 'sf'

// Extended types for 1.x.0
export interface TaskExtended extends Task {
  type?: string
  state?: string
  needs_fs?: string[]
  needs_ss?: string[]
  needs_ff?: string[]
  needs_sf?: string[]
}
```

### src/main/parser.ts

```typescript
import { parse, stringify } from 'yaml'
import type { PlanFile } from '@shared/types'

/**
 * Parse a .plan file, preserving unknown fields
 */
export function parsePlan(content: string): PlanFile {
  const data = parse(content) as PlanFile

  // Apply defaults
  data.version ??= '1.0.0'
  data.tasks ??= []

  for (const task of data.tasks) {
    task.done ??= false
  }

  return data
}

/**
 * Stringify a .plan file, preserving field order and unknown fields
 */
export function stringifyPlan(plan: PlanFile): string {
  return stringify(plan, {
    indent: 2,
    lineWidth: 0, // No line wrapping
  })
}
```

---

## 11. Agent Context Files (AGENTS.md / CLAUDE.md)

This section defines how to set up the **context engineering layer** — the files that tell AI coding agents how to work with this codebase. Following the [ASDLC AGENTS.md Specification](https://agents.md), we treat these files with the same rigor as production code: version controlled, falsifiable, and optimized for LLM context windows.

### Why This Matters

Agents are stateless. Each new session starts with blank context. Without grounding, the agent reverts to generic training weights — forgetting our architectural decisions, dependency choices, and accumulated lessons. AGENTS.md acts as persistent "standing orders" that solve this **Context Amnesia** problem.

### Tool-Specific File Support

Different AI tools look for different filenames. Create both to maximize compatibility:

| Tool | Expected File | Notes |
|------|---------------|-------|
| **Cursor** | `.cursorrules` | Also reads `AGENTS.md` |
| **Windsurf** | `.windsurfrules` | Also reads `AGENTS.md` |
| **Claude Code** | `CLAUDE.md` | Does **not** read `AGENTS.md`; case-sensitive |
| **Codex** | `AGENTS.md` | Native support |
| **VS Code / Copilot** | `AGENTS.md` | Requires `chat.useAgentsMdFile` setting enabled |
| **Zed** | `.rules` | Priority-based; reads `AGENTS.md` at lower priority |

**Setup:** Create `AGENTS.md` as the single source of truth, then symlink for Claude Code:

```bash
# Create the canonical file
touch AGENTS.md

# Symlink for Claude Code compatibility
ln -s AGENTS.md CLAUDE.md
```

> **Note:** Claude Code also supports `CLAUDE.local.md` for personal preferences that shouldn't be version-controlled. Add `CLAUDE.local.md` to `.gitignore`.

### AGENTS.md Structure

The file follows a seven-part structure optimized for signal density:

#### Part 1: Contextual Alignment (The Mission)

A concise project description that sets the stage for every agent session. This differentiates a "task" in Project Partial (DAG node with dependencies) from a "task" in a todo app (flat list item).

```markdown
# AGENTS.md — Context & Rules for AI Agents

> **Project:** Partial — Agent-native project management via `.plan` files.
> **Core Philosophy:** Projects are DAGs of state, not lists. Local-first,
> Git-based persistence. The `.plan` file is the single source of truth.
> **Key Constraint:** Unknown fields in `.plan` files must always be preserved
> (round-trip safety). Parsers must never discard data they don't understand.
```

#### Part 2: Identity Anchoring (Personas)

Define personas with explicit triggers, goals, and guidelines. This prunes the model's search space — "Principal TypeScript Engineer" produces better code than "coding assistant."

```markdown
## 1. Personas

### 1.1. Architect / Spec Lead (@Architect)
**Trigger:** When asked about system design, .plan schema evolution, or planning.
* **Goal:** Define specifications, architectural decisions, and feature requirements.
* **Guidelines:**
  - Schema changes to `.plan` format require an ADR in `docs/decisions/`
  - Always produce clear specs before handing off to implementation
  - Break large tasks into bounded PBIs with acceptance criteria
  - Protect round-trip safety: never propose schema changes that break unknown-field preservation

### 1.2. Developer / Implementation Agent (@Dev)
**Trigger:** When assigned implementation tasks, bug fixes, or refactoring.
* **Goal:** Implement features and ensure the codebase remains healthy.
* **Guidelines:**
  - Work from defined PBIs with clear acceptance criteria when available
  - TypeScript strict mode: no `any` types, no non-null assertions without justification
  - All Svelte components use Svelte 5 runes syntax (`$state`, `$derived`, `$effect`)
  - Explicitly import all dependencies; no implicit globals
  - All changes must pass `npm run check` and `npx tsc --noEmit`

### 1.3. Parser / Engine Developer (@Engine)
**Trigger:** When working on YAML parsing, DAG logic, or the watcher.
* **Goal:** Maintain the core engine with emphasis on correctness and round-trip safety.
* **Guidelines:**
  - Unknown YAML fields are ALWAYS preserved — this is non-negotiable
  - Use Zod schemas for validation; never cast `as` without validation
  - DAG operations must detect and reject cycles
  - File watcher must handle rename, delete, and rapid-save events gracefully

### 1.4. CLI Developer (@CLI)
**Trigger:** When working on the `partial` command-line tool.
* **Goal:** Build a reliable, composable CLI following Unix conventions.
* **Guidelines:**
  - Output parseable formats (JSON with `--json` flag, plain text default)
  - Exit codes: 0 = success, 1 = user error, 2 = system error
  - All commands must work with stdin/stdout piping
```

#### Part 3: Operational Grounding (Tech Stack)

Explicitly define the environment to prevent "Library Hallucination" — agents inventing dependencies that don't exist in the project.

```markdown
## 2. Tech Stack (Ground Truth)

- **Runtime:** Node.js 20+ (LTS) exclusively
- **Language:** TypeScript 5.x, strict mode enabled
- **Desktop Shell:** Electron (via electron-vite)
- **UI Framework:** Svelte 5 (runes syntax) — do NOT use Svelte 4 patterns
- **Visualization:** D3.js — do NOT use Chart.js, Recharts, or other charting libraries
- **YAML Parsing:** `yaml` package — do NOT use `js-yaml` or other parsers
- **Schema Validation:** Zod — do NOT use Joi, Yup, or io-ts
- **File Watching:** chokidar
- **Graph Logic:** graphlib
- **Linting/Formatting:** Biome — do NOT use ESLint or Prettier
- **Git Hooks:** Lefthook — do NOT use Husky or lint-staged
- **Testing:** Vitest — do NOT use Jest
- **Commits:** Conventional Commits (enforced by Lefthook)
```

#### Part 4: Behavioral Boundaries (Three-Tiered Constitution)

Categorize rules by severity. Absolute prohibitions are aspirational for probabilistic models — complement these with deterministic quality gates (linters, tests, CI).

```markdown
## 3. Operational Boundaries

### Tier 1 — ALWAYS (Constitutive)
- ALWAYS preserve unknown fields when parsing/writing `.plan` files
- ALWAYS add JSDoc comments to exported functions
- ALWAYS use Conventional Commits format
- ALWAYS handle errors explicitly; never swallow with empty catch blocks
- ALWAYS write tests for new parser logic and DAG operations

### Tier 2 — ASK (Procedural / Human-in-the-Loop)
- ASK before adding any new npm dependency
- ASK before modifying the `.plan` schema (version bump required)
- ASK before changing Electron IPC contracts between main/renderer
- ASK before modifying CI/CD workflows
- ASK before restructuring the directory layout

### Tier 3 — NEVER (Hard Constraints)
- NEVER commit secrets, API keys, or `.env` files
- NEVER use `any` type in TypeScript (use `unknown` + type guards)
- NEVER modify `src/shared/types.ts` without updating Zod schemas
- NEVER introduce CSS frameworks (Tailwind, etc.) — use scoped Svelte styles
- NEVER add ORM libraries — all data lives in `.plan` files
- NEVER bypass Biome linting rules with inline ignores without justification
```

#### Part 5: Semantic Directory Mapping

Annotated YAML that acts as a map legend — agents can route tasks to the correct file without scanning every file.

```markdown
## 4. Directory Map
```yaml
directory_map:
  src:
    main:
      index.ts: "Electron main process entry; creates BrowserWindow, sets up IPC"
      watcher.ts: "Chokidar-based file watcher for *.plan files; emits change events"
      parser.ts: "YAML ↔ PlanFile conversion; preserves unknown fields on round-trip"
    renderer:
      main.ts: "Svelte app bootstrap; mounts App.svelte"
      App.svelte: "Root component; handles view switching (Gantt/Kanban/Graph)"
      views:
        Gantt.svelte: "D3-powered Gantt chart; reads DAG for timeline rendering"
        Kanban.svelte: "Drag-and-drop board; maps task state to columns"
        Graph.svelte: "D3 force-directed DAG visualization of dependencies"
      components:
        TaskCard.svelte: "Reusable task display unit used across all views"
    shared:
      types.ts: "PlanFile and Task interfaces; the TypeScript schema for .plan format"
      dag.ts: "DAG construction, cycle detection, topological sort, critical path"
    cli:
      index.ts: "CLI entry point; subcommands: validate, status, unblocked, graph"
  tests: "Mirrors src/ structure; Vitest test files"
  plans: "Living specs organized by feature domain (one spec.md per feature)"
  docs:
    decisions: "Architecture Decision Records (ADRs)"
```
```

#### Part 6: Command Registry

Force agents to use the correct commands — prevents defaulting to `npm test` when we use `vitest`.

```markdown
## 5. Command Registry

| Intent | Command | Notes |
|--------|---------|-------|
| **Dev** | `npm run dev` | Electron + Vite HMR |
| **Build** | `npm run build` | Outputs to `dist/` |
| **Test** | `npm test -- --run` | Vitest, single run |
| **Test (watch)** | `npm test` | Vitest, watch mode |
| **Coverage** | `npm run test:coverage` | Vitest + v8 coverage |
| **Lint** | `npm run check` | Biome check (lint + format) |
| **Lint (fix)** | `npm run check:fix` | Biome auto-fix |
| **Type Check** | `npx tsc --noEmit` | TypeScript compilation check |
| **Svelte Check** | `npx svelte-check` | Svelte-specific diagnostics |
| **Git Hooks** | `npx lefthook install` | Initialize git hooks |
```

#### Part 7: Coding Standards (XML-Tagged for Adherence)

Use pseudo-XML tags to create semantic structure that models parse more strictly than bullet points.

```markdown
## 6. Coding Standards

<coding_standard name="Svelte Components">
  <instruction>
    Use Svelte 5 runes syntax. Functional, composable components.
    Props via $props(), reactive state via $state(), derived via $derived().
  </instruction>
  <anti_pattern>
    export let prop; // Svelte 4 syntax
    $: derived = ... // Svelte 4 reactive declarations
  </anti_pattern>
  <preferred_pattern>
    let { prop } = $props();
    let derived = $derived(expression);
  </preferred_pattern>
</coding_standard>

<coding_standard name="Error Handling">
  <instruction>
    All errors must be explicitly handled. Use Result types or
    try/catch with typed error handling. Never swallow errors.
  </instruction>
  <anti_pattern>
    try { ... } catch (e) { }
    try { ... } catch (e) { console.log(e) }
  </anti_pattern>
  <preferred_pattern>
    try { ... } catch (e: unknown) {
      if (e instanceof ParseError) { handleParseError(e) }
      else { throw e }
    }
  </preferred_pattern>
</coding_standard>

<coding_standard name="Plan File Parsing">
  <instruction>
    Unknown fields MUST survive round-trips. Use spread operators
    and index signatures. Never destructure-and-reconstruct plan data.
  </instruction>
  <anti_pattern>
    const { version, project, tasks } = planData;
    return { version, project, tasks }; // Drops unknown fields!
  </anti_pattern>
  <preferred_pattern>
    return { ...planData, tasks: processedTasks }; // Preserves all fields
  </preferred_pattern>
</coding_standard>
```

#### Context References

```markdown
## 7. Context References

- **Plan Schema:** See `src/shared/types.ts` for canonical TypeScript types
- **Plan Spec:** See `Design Documents/Project Partial - The Plan Standard.md`
- **Scaffolding:** See `Design Documents/Scaffolding.md`
- **Feature Specs:** See `plans/{feature}/spec.md`
- **ADRs:** See `docs/decisions/`
```

### Verifying AGENTS.md Setup

```bash
# Verify symlink works
ls -la CLAUDE.md  # Should show: CLAUDE.md -> AGENTS.md

# Verify .gitignore includes local overrides
grep "CLAUDE.local.md" .gitignore

# Verify AGENTS.md is tracked
git add AGENTS.md
git commit -m "docs: add AGENTS.md agent context file"
```

---

## 12. Living Specs (plans/ Directory)

Following the ASDLC [Living Specs](https://asdlc.dev) practice, feature-level specifications live alongside the code as permanent sources of truth. Unlike tickets (which capture deltas/changes), specs capture the current **state** of how a feature works.

### Directory Structure

```
plans/
├── plan-parser/
│   └── spec.md          # How .plan files are parsed and validated
├── dag-engine/
│   └── spec.md          # DAG construction, cycle detection, resolution
├── file-watcher/
│   └── spec.md          # File watching behavior and event handling
├── gantt-view/
│   └── spec.md          # Gantt chart rendering and interaction
├── kanban-view/
│   └── spec.md          # Kanban board behavior
└── cli/
    └── spec.md          # CLI commands and behavior
```

### Spec Template

Each `spec.md` follows the Blueprint + Contract structure:

```markdown
# Feature: [Feature Name]

## Blueprint

### Context
[Why does this feature exist? What problem does it solve?]

### Architecture
- **API Contracts:** [Endpoints, IPC channels, function signatures]
- **Data Models:** [Schema references, type definitions]
- **Dependencies:** [What this depends on / what depends on this]

### Anti-Patterns
- [What agents must NOT do when working on this feature, with rationale]

## Contract

### Definition of Done
- [ ] [Observable, testable success criterion]
- [ ] [Observable, testable success criterion]

### Regression Guardrails
- [Critical invariant that must never break]

### Scenarios
**Scenario: [Happy path name]**
- Given: [Precondition]
- When: [Action]
- Then: [Expected outcome]

**Scenario: [Edge case name]**
- Given: [Precondition]
- When: [Action]
- Then: [Expected outcome]
```

### Maintenance Rules

The **Same-Commit Rule** applies: if code changes behavior, the relevant spec must be updated in the same commit. This prevents documentation decay.

```bash
git commit -m "feat(parser): add support for needs_ss dependency type

- Implements Start-to-Start dependency parsing
- Updates plans/plan-parser/spec.md with new dependency type"
```

---

## 13. Agent Instructions

When scaffolding this project, follow these steps in order:

1. **Clone/init repository**
2. **Run `npm install`** to install all dependencies
3. **Run `npx lefthook install`** to set up git hooks
4. **Create initial directory structure** as shown in Section 2
5. **Copy configuration files** (biome.json, lefthook.yml, tsconfig.json)
6. **Create initial type definitions** in `src/shared/types.ts`
7. **Create `AGENTS.md`** following the template in Section 11
8. **Create `CLAUDE.md` symlink:** `ln -s AGENTS.md CLAUDE.md`
9. **Create `plans/` directory** with initial spec for the parser feature
10. **Add `CLAUDE.local.md`** to `.gitignore`
11. **Commit with:** `chore: initial project scaffolding`

### Micro-Commit Strategy

Follow the ASDLC micro-commit practice — commit after every discrete task, not at the end. This creates reversible checkpoints:

```bash
# Step-by-step commit sequence for scaffolding:
git commit -m "chore: initialize package.json and dependencies"
git commit -m "chore: add TypeScript and Biome configuration"
git commit -m "chore: add Lefthook git hooks and Conventional Commits enforcement"
git commit -m "chore: add Electron builder configuration"
git commit -m "chore: create initial directory structure and shared types"
git commit -m "docs: add AGENTS.md agent context file"
git commit -m "docs: add initial living spec for plan-parser feature"
git commit -m "ci: add GitHub Actions CI and release workflows"
```

### Verification Checklist

After scaffolding, verify:

```bash
# All commands should pass
npm run check           # Biome linting
npx tsc --noEmit        # TypeScript compilation
npx svelte-check        # Svelte type checking
npm test -- --run       # Tests (will be empty initially)
npm run dev             # Electron dev server starts

# Agent context files
ls -la CLAUDE.md        # Symlink → AGENTS.md
cat AGENTS.md           # Should contain full agent context
ls plans/               # Should contain feature spec directories
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Lefthook not running | Run `npx lefthook install` |
| Biome errors on save | Check IDE extension is using project's biome.json |
| Electron blank window | Check main/index.ts loads renderer correctly |
| Import path errors | Verify tsconfig paths match actual structure |
| CLAUDE.md not working | Verify symlink: `ls -la CLAUDE.md` should show `→ AGENTS.md` |
| Agent ignoring rules | Check AGENTS.md is in repo root, not a subdirectory |
| Cursor not reading rules | Verify `.cursorrules` symlink exists, or copy AGENTS.md content |
