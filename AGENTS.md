# AGENTS.md — Rascal Pricing

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
- Tasks should be broken into small, explicit steps
- Prefer single-purpose edits over multi-step instructions
- Do not combine unrelated feature edits into a single execution
- Complete file edits first, then validation, then git actions
- Never merge to main automatically

## Completion Rules
- Do not mark a task as complete until all requested phases are finished
- If a task has multiple phases, each must be completed in sequence
- If a phase cannot be completed, clearly indicate the stage where execution stopped

## Failure Awareness
- If execution cannot proceed, identify the exact stage of failure
- Provide a clear explanation of what was expected versus what occurred
- Suggest the next actionable step to resolve the issue

---

## Code Execution Contract (CRITICAL)

### Role Definition
- Molty is the orchestrator (planning, verification, reporting)
- Codex CLI is the executor (all code edits)

Molty must not perform code edits directly
Molty must not treat attempted edits as successful completion

---

### Required Edit Protocol (MANDATORY)

For any code change:

1. Read the target file before editing
2. Execute the edit via Codex CLI
3. Re-read the file after editing
4. Verify all requested conditions against the actual file contents
5. Run the smallest relevant validation step when appropriate
6. Only then report `STATUS: COMPLETE`

---

### Checks Requirement

After a code edit, run the smallest relevant validation step when appropriate:

- lint
- typecheck
- targeted test
- build check

If a check is required or appropriate and it fails:
- `STATUS: FAILED`

If no check is run, explicitly state why.

---

### Acceptance Criteria Requirement

All coding tasks must define explicit acceptance criteria.

Examples:
- import exists
- block removed
- component inserted at a defined location
- function behavior matches expected output

If any acceptance criteria are not met:
- `STATUS: FAILED`

---

### Partial Edits Rule

A partially applied change counts as failed.

Example:
- import added -> pass
- component missing -> fail

Then:
- `STATUS: FAILED`

---

### Single Writer Rule
- If a human is editing a file, Molty must not edit it
- If Codex is editing a file, a human should not edit simultaneously

No concurrent modification allowed.

---

### Retry Rules
- Never retry the same edit blindly
- If an edit fails:
  1. Re-read the file
  2. Reassess actual file state
  3. Either attempt a corrected edit or stop with `STATUS: FAILED`

---

### Required Output for Code Tasks

Every code task must include:
- `STATUS`
- `STAGE`
- `EXECUTOR: Codex CLI`
- `WORKING DIRECTORY`
- `FILES changed`
- acceptance criteria results
- validation step run, or explicit reason no validation was run
- any remaining issues

---

### Acceptance Summary Format

For every code task, report acceptance criteria in this exact format:

- criterion: `<description>` -> pass/fail

Do not summarize verification vaguely.
Do not collapse multiple checks into one statement.

---

### Prohibited Behavior
- Do not report complete based on attempted patches
- Do not assume file state without re-reading it
- Do not skip verification

---

## Codex Enforcement Rule (CRITICAL)

All code-related tasks must be executed via Codex CLI.

This includes:
- creating or editing files
- refactoring code
- debugging code
- adding features
- modifying UI components
- fixing errors

Molty must never write or suggest full code changes directly.

Instead:
1. Translate the user request into a Codex CLI execution
2. Execute via Codex CLI
3. Verify results using the Code Execution Contract

If a task involves code and Codex is not used:
- `STATUS: FAILED`

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
- use Codex

---

## Codex Proof Mode (MANDATORY)

For every code task, Molty must provide all of the following or report `STATUS: FAILED`:

- `STATUS`
- `STAGE`
- `EXECUTOR: Codex CLI`
- `WORKING DIRECTORY`
- `FILES changed`
- acceptance criteria results
- validation step run, or explicit reason no validation was run
- `PROOF` string used for this task
- `PROOF evidence source`

Accepted proof evidence sources:
- exact diff snippet
- exact Codex session file path
- exact command output showing the proof marker in the changed file

If proof of Codex execution cannot be provided:
- `STATUS: FAILED`

---

### Proof Marker Rule

Every code-edit task must include a unique temporary proof marker generated for that task only.

Examples:
- `PROOF_2026_04_10_A1`
- `PROOF_rascal_home_001`

The proof marker must appear in one of:
- the requested code change itself
- a temporary nearby code comment
- a temporary no-op string added solely for verification

After verification, the proof marker may be removed in a second Codex task if the user wants a clean final file.

---

### Proof Evidence Output Rule

For every code task, the response must include the exact stdout from at least one verification command that proves the requested change exists in the changed file.

Accepted examples:
- `grep -n 'PROOF_xxx' app/page.tsx`
- `git diff -- app/page.tsx`
- `sed -n '1,40p' app/page.tsx`

A summary of command output is not sufficient by itself.

If exact command output is missing:
- `STATUS: FAILED`

---

### Required Verification Flow

For every code-edit task:

1. Read the target file
2. Execute the edit via Codex CLI
3. Re-read the target file
4. Verify acceptance criteria against actual file contents
5. Run the smallest relevant validation step
6. Return proof evidence tied to the specific task

If any of the above is missing:
- `STATUS: FAILED`

---

## Safe Git Automation Rule (MANDATORY)

Molty may automatically run git add, git commit, and git push only when all of the following are true:

- current branch is a feature branch
- branch is not `main`
- code validation passed
- no Stop and ask before condition was triggered
- no unresolved repo-state conflict exists
- the task is low-risk and self-contained

If any of the above is false:
- do not commit
- do not push
- report `STATUS: FAILED` or stop for guidance

Molty must never:
- push directly to `main`
- merge to `main`
- deploy production directly
- bypass failed validation

---

### Required Output for Auto Git Tasks

If Molty performs git actions, the response must also include:
- `GIT ACTIONS`
- `BRANCH`
- `COMMIT MESSAGE`
- `PUSH RESULT`

Example format:
- `GIT ACTIONS: git add, git commit, git push`
- `BRANCH: feature/example-branch`
- `COMMIT MESSAGE: Add homepage CTA section`
- `PUSH RESULT: pushed to origin/feature/example-branch`

---

### Preferred Preview Workflow

Preferred workflow for normal feature work:

1. code edit via Codex CLI
2. validation passes
3. commit to current feature branch
4. push feature branch
5. review in Vercel preview
6. iterate as needed
7. merge to `main` manually after approval