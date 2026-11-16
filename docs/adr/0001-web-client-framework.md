# ADR-0001: Propose Next.js as the V1 web client framework

- Status: Proposed
- Date: 2026-11-15

## Context

The first system-design session named four user profiles and set different freshness bounds for status, search, analytics, and reports. Those bounds are exercise targets in the [requirements](../requirements/README.md). The session also described shipment creation as internal persistence first, with carrier confirmation later, and with the interface showing a pending state.

The architect's preliminary direction is a responsive, mobile-first web application for V1. A native mobile application is not required for that first release. The session studied server rendering, client rendering, static rendering, Server Components, Client Components, hydration, and four ways to refresh data: polling, server-sent events, WebSockets, and `router.refresh()`.

The dashboard rendering strategy, cache invalidation, frontend authentication, and the live-update mechanism were left open. The technical review of the framework has not concluded. The discussion is recorded in the [interview note](../interviews/2026-11-15-system-design-frontend.md).

This record exists so the preliminary framework preference cannot be read as an accepted decision.

## Alternatives considered

### Leave the web framework unnamed until the review ends

Keep the preliminary channel decision (a responsive web application) and do not name a framework. Later tasks stay free of a client stack. The cost is that the review can stall, and the concepts already studied have no single framework to attach to.

### Next.js as the V1 web framework

This is the architect's initial proposal, and the only web framework named in the session. Server Components, Client Components, hydration, and `router.refresh()` were discussed in that vocabulary. The cost of accepting it now is that rendering, cache, authorization, and the update mechanism are still open. Those choices would then be made inside Next.js, and a later move to another client would be more expensive.

### A native mobile client for V1

Ship iOS and Android applications as the first client. The architect set this aside: a native application is not necessary for the initial release. The cost of taking it anyway is a second client surface before tenancy, shipment creation, and the freshness rules are implemented. It remains available after V1.

Other web frameworks were not compared in the session. This proposal is not the result of a completed framework evaluation.

## Decision

Propose Next.js as the framework for the V1 web client. The proposal is not accepted.

This record does not choose hybrid rendering, a cache, a real-time mechanism, or frontend authentication and authorization. It does not accept or reject the mobile-first web channel. That channel direction stays a preliminary note in the interview until a later record takes it up. Implementation must not depend on this ADR while its status is Proposed.

## Rationale

The session produced a real preference and an explicit condition: Next.js is the starting proposal, and the technical review is still open. A Proposed record is the status this repository uses for a choice under review. Accepting it now would freeze a tool before the dashboard, the 10-second status bound, and authorization have been decided. Leaving the preference only in conversation would make the same choice look settled.

## Consequences and trade-offs

- No application code, dependency, or infrastructure may assume Next.js until this ADR is accepted.
- If it is later accepted, the client work can use the component model already studied. `router.refresh()` would be one update option beside polling, server-sent events, and WebSockets, not the chosen one.
- Acceptance would still leave these items open: the dashboard rendering strategy, status refresh within 10 seconds, cache and invalidation, frontend authentication and authorization, and table and filter performance.
- Rejection stays cheap only while no code is written against the proposal.
- Hybrid rendering for the dashboard was considered in the session and is not part of this proposal.
