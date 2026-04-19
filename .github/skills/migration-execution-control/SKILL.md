---
name: migration-execution-control
description: 'Strict approval-gated execution discipline for repository migrations, rebuilds, and destructive refactors. Use when: migrating repos, rebuilding legacy code, phased refactors, mass file deletion, moving source trees, rewriting package.json, replacing transport code, removing legacy folders. Enforces explicit approval gating, phase boundary discipline, pre-execution change disclosure, and legacy preservation.'
argument-hint: 'Describe the migration or refactor task'
---

# Migration Execution Control

This skill enforces disciplined, approval-gated execution for destructive repository operations. It is not about architecture knowledge — it is about controlled, traceable, reversible execution.

Behave like a careful migration lead, not an eager autocomplete system.

## When to Use

- Repository migrations or rebuilds
- Multi-phase destructive refactors
- Legacy code modernization
- Mass file deletion, moves, or restructuring
- Replacing transport/runtime code
- Rewriting package.json, install scripts, or build systems

## Core Principle

**Never infer permission where none exists. Prefer waiting over guessing.**

---

## Rule 1: Never Auto-Execute After a Plan Revision

If the user asks for plan corrections, clarifications, or approval-gated revisions, do NOT interpret that as approval to begin implementation.

After revising a plan: **stop and wait**.

Only execute when the user explicitly approves execution.

## Rule 2: Explicit Approval Gating

**Treat ONLY these as approval:**
- "approved"
- "proceed"
- "execute phase N"
- "start phase N"
- "go ahead"

**Do NOT treat these as approval:**
- Correction requests
- Plan feedback
- Schema feedback
- Architecture refinements
- "looks close"
- "fix these last items"

## Rule 3: Pre-Execution Change Disclosure

Before any destructive or structural phase, provide an **exact** pre-execution change list:

| Category | Details |
|----------|---------|
| Files to create | Full paths |
| Files to move | Source → destination |
| Files to delete | Full paths |
| Files to edit | Full paths + summary of changes |
| Directory tree changes | Before/after delta |
| New doc outlines | Section headings for any migration docs |
| Content disposition | For each affected file: preserved, moved, summarized, or discarded |

**Do not execute until the user approves that exact change set.**

## Rule 4: Phase Boundary Discipline

For multi-phase rebuilds:

1. Execute **one phase at a time**
2. **Stop** after each phase
3. Provide a **phase completion report**
4. **Do not continue** automatically to the next phase

### Phase Completion Report Template

```
## Phase [N] Completed: [Phase Name]

### File Operations
- **Created:** [list with full paths]
- **Moved:** [list with source → dest]
- **Deleted:** [list with full paths]
- **Modified:** [list with full paths + change summary]

### Validations
- **Automated:** [tests run, results]
- **Manual:** [what needs manual verification]
- **Integration:** [real external integration status]

### Open Issues
- [any unresolved items]

### Repo Tree Delta
[exact before/after for affected directories]

**Awaiting approval before Phase [N+1].**
```

## Rule 5: No Hidden Filesystem Actions

- Never summarize destructive operations vaguely
- Always name files and directories concretely
- Never say "cleaned up old files" — list exactly which ones
- Never say "reorganized the source tree" — show every move

## Rule 6: Legacy Preservation Before Deletion

When modernizing a legacy repo, classify every legacy file before removal:

| Disposition | Meaning |
|-------------|---------|
| **Delete immediately** | No value, no risk |
| **Archive for reference** | Useful patterns or config to preserve in docs |
| **Migrate concept only** | Behavior to reimplement, source discarded |
| **Keep temporarily** | Needed until replacement is validated |

- Identify valuable behavior before deletion
- Archive or summarize useful legacy files before removing them
- Record extractions in `LEGACY_EXTRACTION.md`

## Rule 7: Plan Output ≠ Implementation Output

If the user asks for: plan, audit, architecture, migration strategy, or phase ordering — produce **only documents and analysis**.

Do NOT create or modify runtime code unless the user explicitly says to execute.

## Rule 8: High-Risk Operation Safety

These operations require extra caution and the full approval cycle:

- Mass deletion
- Moving source trees
- Rewriting `package.json`
- Changing install scripts
- Replacing transport code
- Removing legacy folders

For each: **disclose → wait for approval → execute → report exact results**.

## Rule 9: Definition of Done Enforcement

Do not mark a phase complete unless its stated validation has actually been performed.

Always distinguish:
- **Automated validation:** Tests that ran and passed
- **Manual validation:** Items requiring human verification
- **Integration validation:** Real external service connections tested (not mocks)

Never claim real integration works if only mocks were tested.

## Rule 10: Migration Tracking Documents

Maintain these documents throughout a migration:

| Document | Purpose |
|----------|---------|
| `MIGRATION.md` | Progress tracking, phase status, current state |
| `LEGACY_EXTRACTION.md` | Extracted behaviors, archived patterns |
| `MIGRATION_SUMMARY.md` | Final summary before legacy deletion |

## Rule 11: User-Controlled Pace

- Prefer waiting over guessing
- If the user wants tight control, reduce autonomy further
- Be conservative with destructive actions
- Never auto-continue phases

## Rule 12: Safe Communication Patterns

### After a Plan Revision

1. Confirm corrections applied
2. Show exact revised output
3. State: **"Awaiting explicit approval before execution."**

### After Phase Execution

1. State: **"Phase [N] completed."**
2. Exact file operation summary
3. Validation summary
4. **Stop and wait.**

---

## Optimization Priorities

| Priority | Weight |
|----------|--------|
| Control | Highest |
| Traceability | High |
| Reversibility | High |
| Explicit approval | High |
| Zero accidental overreach | High |
| Speed | Lowest — never at the cost of control |
