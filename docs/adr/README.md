# Architecture Decision Records

An Architecture Decision Record (ADR) captures one significant technical choice: the context that forced it, the alternatives that were examined, the choice itself, why it won, and the consequences that follow.

ADRs are append-only. A later change supersedes an earlier record. It does not rewrite history.

No ADR has been accepted yet. Do not add one in anticipation of an interview. Add one when a decision is actually made and is ready to constrain later work.

## When to write an ADR

Write an ADR when a choice will be expensive to reverse, or when later implementation would otherwise have to guess. Examples:

- Where a boundary is drawn between parts of the system
- How tenant data is isolated
- How tracking events are stored and ordered
- Which consistency guarantee a workflow receives
- How the service is deployed in US East, and what Europe expansion assumes

Do not write an ADR for a temporary local experiment, a formatting preference, or a choice that the next task can change without cost.

## File name

```text
docs/adr/NNNN-short-kebab-title.md
```

`NNNN` is a zero-padded sequence starting at `0001`. Numbers are not reused. A superseded ADR keeps its number.

## Required sections

Use this template. Keep the section names stable so records can be compared.

```markdown
# ADR-NNNN: Title

- Status: Proposed | Accepted | Superseded by ADR-MMMM
- Date: YYYY-MM-DD

## Context

What problem forces a decision now, and which requirements constrain it?

## Alternatives considered

### Alternative A

What it is, and the main cost of choosing it.

### Alternative B

What it is, and the main cost of choosing it.

## Decision

The choice, stated so a later change can follow it without rereading the interview.

## Rationale

Why this alternative won against the requirements and the alternatives above.

## Consequences and trade-offs

What becomes easier, what becomes harder, and which risks are accepted on purpose.
```

## Status meanings

| Status | Meaning |
|---|---|
| Proposed | Written for review. Implementation must not depend on it yet |
| Accepted | The decision is in force |
| Superseded by ADR-MMMM | Kept for history. The linked ADR is in force |

## Rules

- One decision per record. Split a record that decides two reversible choices at once.
- Name alternatives that were genuinely available. Do not invent a weak alternative so the chosen one looks stronger.
- State trade-offs in the consequences section even when the decision is accepted.
- Link the interview note that produced the decision when one exists.
- Do not record a product, library, or hosting choice here until that choice has been through the interview cycle.
