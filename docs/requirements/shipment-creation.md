# Shipment creation

Business behavior from the first system-design session. This document does not choose an API, a database, a retry library, a queue, or a carrier adapter.

The requester in the session is the customer. Which user profiles are allowed to create a shipment is still an open permission question in the [requirements](README.md).

## Behavior

1. The customer requests creation of a shipment.
2. The system validates the request and persists the shipment internally.
3. Confirmation from the carrier can happen later. Internal persistence and carrier confirmation are different outcomes.
4. While the carrier is unavailable, the shipment remains awaiting confirmation.
5. The interface tells the user that the shipment is pending confirmation.
6. A communication failure with an unknown result requires reconciliation before another attempt. Retrying without knowing whether the carrier accepted the first attempt can create a duplicate at the carrier.
7. A stable reference identifies the operation, so the platform can query it at the carrier when that carrier supports the query.
8. Idempotency inside the platform does not automatically make the call to the carrier idempotent.

## Relationship to the create-shipment target

Create shipment has a p95 target of 500 ms and strong consistency for internal creation. That target covers step 2. It does not require step 3 to finish inside 500 ms, and it does not define how step 6 is implemented.

## Explicitly not decided

- Validation rules and required fields.
- The name of the pending state, and who can see it.
- How reconciliation discovers the unknown result.
- What the platform does when the carrier cannot be queried by the stable reference.
- How long a shipment may wait for confirmation.
- The request and response shapes for FedEx, UPS, and DHL.
