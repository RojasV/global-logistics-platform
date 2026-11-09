# Interviews

This folder is the log of simulated senior-engineer interviews that drive the repository. A session is recorded when it happens. This file does not invent sessions in advance.

## Cycle

Each interview feeds the same cycle:

**Technical interview → Architectural decision → Microtask → Implementation → Validation → Commit.**

- The interview note records the problem, the constraints that were used, and the outcome.
- A decision that later work must follow becomes an [ADR](../adr/README.md) before implementation.
- A microtask is the only approval to change behavior. It names the ADR it depends on, when it depends on one.
- The commit that closes the task stays small enough to review against that task.

## Note template

Create `docs/interviews/YYYY-MM-DD-short-title.md` after a session.

```markdown
# YYYY-MM-DD — Title

## Prompt

What was asked, in enough detail that the conclusion can be checked later.

## Constraints used

Requirements and earlier ADRs that bounded the discussion.

## Discussion

The alternatives that were compared, including the ones that were rejected.

## Outcome

- Decision: link to the ADR, or "no decision".
- Follow-up task: link to the issue or task, or "none".
- Explicitly left open: items the session refused to decide early.
```

## Log

| Date | Session | Outcome |
|---|---|---|
| — | No interviews recorded yet | Repository bootstrap only |

## Rules

- Do not backfill a note for a conversation that did not produce a reviewable conclusion.
- Do not treat an interview note as permission to implement. The microtask is that permission.
- If a later session reverses a conclusion, supersede the ADR and add a new note. Leave the original note in place.
