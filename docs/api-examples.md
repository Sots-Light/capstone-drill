# Build 4 API examples

Start the server in the `capstone-drill` project folder:

```bash
npm start
```

Keep that terminal open. Run these examples from another Git Bash terminal. The server stores data in memory, so created events and bookings are lost when you stop it.

The examples use the organizer and attendee IDs as simple identifiers in the `x-user-id` header. They are not real login credentials. Replace `EVENT_ID`, `TIER_ID`, and `BOOKING_REFERENCE` with values returned by earlier requests.

## 1. Create an event

```bash
curl -i -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"City Hall","startsAt":"2026-12-05T17:00:00+01:00"}'
```

The response contains the new event `id`. Copy it for the next request.

## 2. Add a ticket tier

```bash
EVENT_ID="paste-event-id-here"

curl -i -X POST "http://localhost:3000/api/events/${EVENT_ID}/tiers" \
  -H "Content-Type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"name":"General","priceInKobo":500000,"capacity":3}'
```

The response contains the new tier `id`. Copy it for the booking request.

## 3. Publish the event

```bash
curl -i -X POST "http://localhost:3000/api/events/${EVENT_ID}/publish" \
  -H "x-user-id: organizer-1"
```

Only the organizer who created the event can add tiers, publish, or unpublish it. An event needs at least one tier before it can be published.

## 4. Search published events

```bash
curl -i "http://localhost:3000/api/events?q=tech&city=lagos&maxPriceInKobo=500000&sortBy=price"
```

Supported query parameters are `q`, `city`, `from`, `to`, `maxPriceInKobo`, `onlyAvailable`, and `sortBy` (`date`, `price`, or `availability`).

## 5. Book tickets for named attendees

```bash
TIER_ID="paste-tier-id-here"

curl -i -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"tierId":"'"${TIER_ID}"'","tickets":[{"firstName":"Ada","lastName":"Obi"},{"firstName":"Tunde","lastName":"Bello"},{"firstName":"Chioma","lastName":"Eze"}]}'
```

The response contains the booking `reference`, the total `amountInKobo` (`1500000`, or ₦15,000), and a separate `id` for each ticket paired with its attendee's first and last name. Copy the reference for payment or cancellation, and keep the ticket IDs for the refund example.

## 6. Pay with the mock gateway

```bash
BOOKING_REFERENCE="paste-booking-reference-here"

curl -i -X POST "http://localhost:3000/api/bookings/${BOOKING_REFERENCE}/pay" \
  -H "x-user-id: attendee-1"
```

The default mock gateway approves the payment. It receives the total amount in kobo, not card details. The test suite configures the gateway to decline when checking the `PAYMENT_DECLINED` behavior.

## 7. Refund one ticket from the paid booking

```bash
TICKET_ID="paste-one-ticket-id-from-the-booking-here"

curl -i -X POST "http://localhost:3000/api/bookings/${BOOKING_REFERENCE}/tickets/${TICKET_ID}/refund" \
  -H "x-user-id: attendee-1"
```

This simulates returning one ticket's price (`500000` kobo, or ₦5,000) to the original payment source; no real money is moved. The booking stays paid, only that ticket becomes refunded, and one seat becomes available again. Its other two tickets stay valid. The response includes the cumulative `refundedAmountInKobo`.

## 8. Create a second booking to try cancellation

```bash
curl -i -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"tierId":"'"${TIER_ID}"'","tickets":[{"firstName":"Chioma","lastName":"Eze"}]}'
```

Copy this response's `reference` into `CANCEL_REFERENCE`. This separate booking stays pending; the booking paid above cannot be cancelled in Build 4.

## 9. Cancel the second pending booking

```bash
CANCEL_REFERENCE="paste-pending-booking-reference-here"

curl -i -X POST "http://localhost:3000/api/bookings/${CANCEL_REFERENCE}/cancel" \
  -H "x-user-id: attendee-1"
```

Only the attendee who made the booking can cancel it, and Build 4 permits cancellation only while it is pending. Cancelling releases its seats and marks its tickets cancelled.

## 10. Unpublish an event

```bash
curl -i -X POST "http://localhost:3000/api/events/${EVENT_ID}/unpublish" \
  -H "x-user-id: organizer-1"
```

The event returns to draft status and disappears from public event search.

## Error response shape

Errors use one JSON shape:

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "A useful description of the problem"
  }
}
```
