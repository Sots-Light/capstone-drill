# AI Log

## Build 1

### Entry 1: (First Run)
- **I wanted the ticket Id to carry the name of theuser and then the code afterwards**
- **AI gave me the script - export function newReference(personName) {
  const cleanName = personName.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return `${cleanName}-${randomChars(5)}`; **
- **what was wrong here is the security bridge in the fact that the story categorically says that the name must not appear with the QR scan, and since that will create a bridge my AI updated with a better script - export function newReference() {
  return `${randomChars(4)}-${randomChars(4)}`; **

## Build 2

### Entry 1: Build 2 implementation
- **What I asked:** Implement search, filtering, stable merge sort, publishing, unpublishing and automated tests using the teacher's Build 2 requirements.
- **What came back:** Added the Build 2 domain functions, `node:test` tests, runnable trial examples and the `npm test` command. Kept money in kobo and retained a separate ID for every booking and ticket.
- **What was wrong (or "nothing"):** The teacher's prompt says cents and names publishing but not unpublishing; these were adapted to kobo and the agreed S04 publish/unpublish criteria. An invalid calendar date was also being normalized by JavaScript, so real-date validation was tightened.
- **Agreed S04 criteria:** Publishing a tiered draft makes it public; publishing without tiers returns `INVALID_STATE` and keeps it hidden; unpublishing returns it to draft and removes it from the public list.

## Build 3

### Entry 1: Architecture, state machine and server skeleton
- **What I asked:** Follow the Build 3 baseline while keeping separate ticket IDs, including a ticket-level status so an individual returned ticket can be marked refunded without changing the other tickets.
- **What came back:** Added architecture and lifecycle diagrams, booking and ticket transition rules, an HTTP router/server, `/health`, safe static-file serving, `PORT` configuration, automated tests and learning trials.
- **What was wrong:** The first `npm test` run had one failure because the new cancellation test used `cancelBooking` without importing it. I explained the `ReferenceError`, and I added the missing import in the test file. The next `npm test` run passed. I also clarified the architecture documentation by adding an embedded HTTP request/data-flow diagram with component shapes and arrows.
- **Design decision:** The booking state tracks payment and overall cancellation/refund; each ticket state tracks an individual return or check-in. A partial ticket refund leaves the booking paid and the other tickets valid. Payment/refunds/scanning are not implemented in this build.
- **Manual check:** Started the local server and opened `/health`; it returned `{"status":"ok"}`.

## Build 4

### Entry 1: Working REST API in memory
- **What I asked:** Implement the Build 4 API using injected async services/repository, mock payment, API-level tests and curl examples, while preserving kobo and individual ticket IDs.
- **What came back:** Added event and booking services, a memory repository, API routes, mock payment gateway, application wiring, curl examples, and real-HTTP API tests. Publishing and unpublishing are both available; organizer and booking ownership use `x-user-id`.
- **What was wrong (or "nothing"):** The user ran `npm test`: all 53 tests passed (7 suites, 0 failures). Manual curl checks succeeded for event and tier creation, publishing and unpublishing, named-ticket booking, mock payment, filtered search, and cancelling an unpaid booking. Cancellation returned the booking and ticket as cancelled; unpublishing returned the event to draft.
- **Agreed choices:** Prices and booking totals remain whole kobo. Each booking ticket has its own ID and a first/last name. Tests configure the payment mock to decline; the caller sends no card data or decline flag. Only the booking owner can pay, and only the event organizer can manage the event.

### Entry 2: Simulated partial ticket refund
- **What I asked:** Add and test a partial refund so that refunding one ticket from a three-ticket booking returns only that ticket's price, restores one seat, and keeps the other tickets valid.
- **What came back:** Added an owner-only API operation to refund a ticket from a paid booking. The mock gateway records a simulated refund for that ticket's kobo price; the ticket is marked refunded, `refundedAmountInKobo` is tracked, and one seat is released. The booking stays paid while any ticket remains valid and becomes refunded only after all its tickets are refunded.
- **What was wrong (or "nothing"):** The full `npm test` run passed: all 55 tests across 7 suites, with 0 failures. The user manually created and paid a three-ticket booking, refunded one ticket through the API, and checked event search. The response showed `refundedAmountInKobo: 500000`, the booking still `paid`, only the selected ticket `refunded`, the other two tickets `valid`, and `seatsLeft: 1`. The refund is simulated only; it does not transfer money to a real bank or card account.
- **Agreed choices:** Refund one ticket by its ticket ID. Keep the other tickets valid, add one seat back to availability, and do not claim a real payment was sent.
