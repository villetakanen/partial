---
name: next-task
description: Pick up the next unblocked task from the backlog and implement it
argument-hint: "[optional PBI id to override selection]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm *), Bash(git *)
---

# Next Task — Fast Value Out First

You are a dev agent working on Project Partial. Pick up the next task from
the backlog, implement it, verify it, and commit it.

## Context

Current backlog state:
!`grep -E '^\#\#\# PBI-|done|^\- \[' plans/backlog.md | head -120`

Current .plan state:
!`grep -E 'id:|done:' demo/partial.plan`

## Selection Rules

1. If `$ARGUMENTS` is provided, work on that specific PBI
2. Otherwise, find the **first PBI whose verification checkboxes are all `[ ]`**
   (not `[x]`) **and whose "Blocked by" dependencies are all completed** (all
   their checkboxes are `[x]`)
3. Among unblocked candidates, prefer **fast-value-out-first**: pick the one
   that unblocks the most downstream PBIs, or the smallest scope if tied

## Implementation Protocol

For the selected PBI:

1. **Read the PBI** from `plans/backlog.md` — understand directive, scope,
   dependencies, and verification criteria
2. **Read the context pointers** — open the referenced spec and scaffolding
   sections listed under "Context"
3. **Implement** — create/modify only the files listed in "Scope". Follow the
   project's coding standards (Biome formatting, TypeScript strict, Svelte 5
   runes, no anti-patterns from specs)
4. **Verify** — check every verification criterion. Run commands where
   applicable (`pnpm test`, `pnpm check`, `pnpm exec tsc --noEmit`, etc.)
5. **Update tracking** — mark verification checkboxes as `[x]` in
   `plans/backlog.md`, and set `done: true` on the matching task in
   `demo/partial.plan`
6. **Commit** — stage only the files in scope + `plans/backlog.md` +
   `demo/partial.plan`. Use Conventional Commits format:
   ```
   <type>(<scope>): <description>

   PBI-NNN: <brief summary of what was done>

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```
7. **Push** — `git push`

## Guardrails

- Do NOT modify files outside the PBI's stated scope (except backlog + .plan)
- Do NOT skip verification steps — run the actual commands
- Do NOT amend previous commits — always create new commits
- If a verification criterion fails, fix the issue before marking it done
- If blocked by a missing dependency, report it and stop
