# 2026-11-15 — System design: requirements, shipment creation, and frontend

## Prompt

Record the first system-design session. The session covered business requirements, the business behavior of shipment creation, and a first pass at the web client. Preliminary preferences must stay distinguishable from accepted architecture.

## Constraints used

- Scale, availability, and the original problem statement in [docs/requirements](../requirements/README.md).
- An ADR is the source of truth for a technical choice. Proposed is not Accepted. Interview notes are background.
- Shipment creation was discussed as business behavior. The session did not choose storage, messaging, or a carrier adapter.
- No application code was in scope.

## Discussion

### Requirements

The session named four user profiles: Enterprise Customer, Operations Agent, Customer Support, and Platform Administrator. It specified functional scope for shipments, integration with FedEx, UPS, and DHL, tracking and event history, operational exceptions, reports and notifications, and tenant isolation with permissions by role.

It also set hypothetical latency and consistency targets for six operations. Those targets are recorded in the requirements document, including the distinction between a fast response and a staleness bound. They are exercise targets, not production measurements.

### Shipment creation

The session separated internal creation from later carrier confirmation. The ordered behavior, including pending confirmation, unknown communication results, a stable carrier reference, and the limit of local idempotency, is recorded in [shipment creation](../requirements/shipment-creation.md). This note does not restate that sequence.

### Frontend

Preliminary architect direction, not an accepted decision:

- V1 is a responsive web application, designed mobile-first.
- A native mobile application is not necessary for the initial release.
- Next.js is the architect's initial framework choice. It remains subject to the technical review.
- A hybrid rendering strategy was considered for the dashboard. It was not selected.

Concepts studied while comparing ways to render and refresh the client:

| Concept | What the session used it to think about |
|---|---|
| SSR | Render a page on the server for a request |
| CSR | Render in the browser after the client loads |
| Static rendering | Serve HTML prepared ahead of the request |
| Server Components | Do part of the UI work without shipping it as client JavaScript |
| Client Components | Keep interaction and browser state in the client bundle |
| Hydration | Attach client behavior to server-rendered HTML |
| Polling | The client asks again on an interval |
| SSE | The server streams events to the client over one connection |
| WebSockets | Either side can send messages on a long-lived connection |
| `router.refresh()` | Refresh the current server-rendered route from the client |

The hybrid-dashboard idea would mix more than one of the rendering approaches. The session did not assign a rendering mode to a screen. The update mechanisms were compared only as candidates for the shipment-status bound of 10 seconds.

## Outcome

- Decision: none accepted. The framework preference is [ADR-0001](../adr/0001-web-client-framework.md), status Proposed. Mobile-first web for V1, and the exclusion of a native app from V1, stay preliminary direction in this note. A second ADR was not opened for the client channel. The session did not compare channel alternatives far enough to constrain implementation.
- Follow-up task: none. This session authorizes documentation only.
- Explicitly left open:
  - Final dashboard rendering strategy.
  - How shipment status stays within a 10-second lag.
  - Cache and invalidation.
  - Authentication and authorization in the frontend.
  - Performance of tables and filters.
  - The real-time update mechanism.
  - The permission matrix for the four profiles.
  - How an unknown carrier result is reconciled.
