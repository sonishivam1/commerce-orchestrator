# Retry Strategy

Because commerce APIs degrade under high load, the platform natively throttles itself and retries transient failures before emitting an error to the user.

## Algorithm: Exponential Backoff with Jitter
When a connector triggers a `TransientError` (e.g. rate limits or server unavailability), the Core Engine implements:

$T = \text{BaseDelay} \times 2^{\text{Attempt}} + \text{Jitter}$

- Jitter prevents "thundering herd" issues where multiple pods retry an overloaded Shopify API simultaneously.
- Validation Errors (e.g. GraphQL semantic/syntax errors) bypass retries.

*See Error Taxonomy diagram for integration path.*
