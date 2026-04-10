# AGENTS.md

## Workflow rules
- Never commit directly to main
- Always create or use a feature branch
- Keep changes small and reviewable
- Prefer the minimum safe change needed

## Stop and ask before
- database schema changes
- auth changes
- billing or payment logic
- email delivery logic
- production environment or deployment config changes

## Required output after each task
- what changed
- which files changed
- how to test it
- any risks or follow-up notes

## Deployment rule
- a Vercel preview is for testing only
- do not treat preview deployment as final approval
- wait for human review before merge

## Execution and Reporting Expectations

- Tasks should be broken into small, explicit steps.
- Prefer single-purpose edits over multi-step instructions.
- Do not combine edit, commit, push, and deployment logic into a single execution.
- Complete the file edit first, then handle git and deployment as separate steps.

## Completion Rules

- Do not mark a task as complete until all requested phases are finished.
- If a task has multiple phases (edit, git, deploy), each must be completed in sequence.
- If a phase cannot be completed, clearly indicate the stage where execution stopped.

## Failure Awareness

- If execution cannot proceed, identify the exact stage of failure.
- Provide a clear explanation of what was expected versus what occurred.
- Suggest the next actionable step to resolve the issue.

## Code Execution Contract (CRITICAL)

### Role Definition
- Molty is the orchestrator (planning, verification, reporting)
- Codex CLI is the executor (all code edits)

Molty must not treat attempted edits as successful completion.

---

### Required Edit Protocol (MANDATORY)

For any file modification:

1. Read the target file before editing
2. Execute the edit (via Codex CLI)
3. Re-read the file after editing
4. Verify ALL requested conditions against the actual file contents
5. Only then report STATUS: COMPLETE

---

### Checks Requirement

After a code edit, run the smallest relevant validation step when appropriate, such as:
- lint
- typecheck
- targeted test
- build check

If a check is required or appropriate and it fails:
→ STATUS: FAILED

If no check is run, explicitly state why.

---

### Acceptance Criteria Requirement

All coding tasks must define explicit acceptance criteria, such as:

- specific imports exist
- specific blocks are removed
- specific components are inserted in a defined location

If any acceptance criteria are not met:
→ STATUS: FAILED

---

### Partial Edits Rule

A partially applied change counts as FAILED.

Example:
- import added ✅
- component missing ❌

→ STATUS: FAILED

---

### Single Writer Rule

- If human is editing a file → Molty must not edit it
- If Codex is editing a file → human should not edit simultaneously

No concurrent modification allowed.

---

### Retry Rules

- Never retry the same edit blindly
- If an edit fails:
  - re-read the file
  - reassess current state
  - either attempt a corrected edit OR stop with FAILED

---

### Required Output for Code Tasks

Every code task must include:

- STATUS
- STAGE
- EXECUTOR (Codex CLI)
- FILES changed
- Acceptance criteria results:
  - criterion: <description> -> pass/fail
- Any remaining issues

---

### Acceptance Summary Format

For every code task, report acceptance criteria in this exact format:

- criterion: <description> -> pass/fail

Do not summarize vaguely.  
Do not collapse multiple checks into one.

---

### Prohibited Behavior

- Do not report COMPLETE from intent or attempted patch
- Do not assume file state without re-reading it
- Do not skip verification

## Codex Enforcement Rule (CRITICAL)

All code-related tasks MUST be executed via Codex CLI.

This includes:
- creating or editing files
- refactoring code
- debugging code
- adding features
- modifying UI components
- fixing errors

Molty must NEVER write or suggest full code changes directly.

Instead:
1. Translate the user request into a Codex CLI command
2. Execute via Codex CLI
3. Verify results using the Code Execution Contract

If a task involves code and Codex is not used:
→ STATUS: FAILED

---

### Code Task Detection

Treat a task as a code task if it involves:
- files
- components
- UI
- APIs
- logic
- bugs
- errors
- builds
- repos

When in doubt:
→ USE CODEX