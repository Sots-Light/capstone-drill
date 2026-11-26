# Build 3-6 architecture and state diagrams

## Application layers

```mermaid
flowchart TD
  Client[Browser or API client] --> Routes[HTTP router and route handlers]
  Routes --> Services[Application services]
  Services --> Rules[Domain rules]
  Services --> Repositories[Repositories and data access]
  Repositories --> Data[(SQLite database)]
```

- **Routes** may read HTTP input, call services, and format HTTP responses; they may not contain booking rules or access storage directly.
- **Services** coordinate use cases and repositories, enforce ownership and application rules, and reuse domain rules; they may not depend on HTTP response objects.
- **Domain rules** validate inputs and decide allowed business state changes; they may not perform HTTP, file, or database I/O.
- **Repositories** may read and write data; they may not decide business rules or call routes.

Build 3 introduced the router and server skeleton. Build 4 added services and a memory repository for API tests. Build 5 uses the SQLite repository for the running server so data survives restarts.

Build 6 adds a browser interface that calls one mock API module. Its mock data remains separate from the server database; Build 7 will replace the mock API's internals with real HTTP requests.

## HTTP request and data flow

```mermaid
flowchart LR
  Client["Browser or phone<br/>HTTP client"] -->|"1. HTTP request<br/>GET /health or GET /"| Node["Node.js server<br/>src/server.js"]
  Config["PORT environment variable<br/>default: 3000"] -.->|"listens on"| Node
  Node --> App["HTTP app<br/>src/http/app.js"]
  App --> Router{"Router<br/>method + path"}

  Browser["Build 6 pages<br/>public/*.html + JS"] --> MockAPI["Browser mock API<br/>public/js/api.js"]
  MockAPI --> MockData[("Build 6 mock data<br/>public/js/mockData.js")]

  Router -->|"GET /health"| Health["Health route"]
  Health -->|"200 JSON<br/>{ status: ok }"| App

  Router -->|"GET /, GET /index.html<br/>and static assets"| Static["Static file handler"]
  Static -->|"safe path lookup"| Public[("public/<br/>index.html and assets")]
  Public -->|"file contents"| Static
  Static -->|"200 file response"| App

  Router -->|"POST /api/events<br/>tiers, publish, unpublish"| EventRoutes["Event API routes"]
  Router -->|"GET /api/events"| SearchRoute["Event search route"]
  Router -->|"POST /api/bookings<br/>pay, refund ticket, cancel"| BookingRoutes["Booking API routes"]
  Router -->|"unknown /api path"| NotFound["JSON 404<br/>NOT_FOUND"]
  EventRoutes --> EventService["Event service"]
  SearchRoute --> EventService
  BookingRoutes --> BookingService["Booking service"]
  EventService -->|"validate and apply event rules"| Domain["Domain rules<br/>search, sorting, state machine"]
  BookingService -->|"validate booking transitions"| Domain
  EventService --> Repository["Async memory repository"]
  BookingService --> Repository
  Repository --> Store[("SQLite events,<br/>tiers, bookings and tickets")]
  BookingService -->|"charge or refund amount in kobo"| Gateway["Mock payment gateway<br/>simulated only; no card data"]
  Gateway -->|"approved or declined"| BookingService
  BookingService -->|"JSON booking response"| App
  EventService -->|"JSON event response"| App

  App -->|"malformed JSON"| BadRequest["JSON 400<br/>BAD_JSON"]
  BadRequest -->|"error response"| App
  App -->|"2. HTTP response"| Client

  classDef client fill:#dae8fc,stroke:#6c8ebf,color:#000;
  classDef server fill:#d5e8d4,stroke:#82b366,color:#000;
  classDef route fill:#fff2cc,stroke:#d6b656,color:#000;
  classDef serviceLayer fill:#e1d5e7,stroke:#9673a6,color:#000;
  classDef error fill:#f8cecc,stroke:#b85450,color:#000;
  class Client client;
  class Node,App server;
  class Router,Health,Static,Public,EventRoutes,SearchRoute,BookingRoutes route;
  class EventService,BookingService,Domain,Repository,Store,Gateway serviceLayer;
  class BadRequest,NotFound error;
```

Build 6 browser pages call only the mock API module, which reads mock data; it does not call the server or SQLite. Builds 3-5 server behavior continues to use SQLite, while API tests may inject an in-memory repository. The client can be your browser on the same computer during development; this does not require a separate Windows Server machine.

## Data model

```mermaid
erDiagram
  USER ||--o{ EVENT : organizes
  USER ||--o{ BOOKING : makes
  EVENT ||--|{ TICKET_TIER : offers
  TICKET_TIER ||--o{ BOOKING : receives
  BOOKING ||--|{ TICKET : contains

  USER {
    string id
    string role
  }
  EVENT {
    string id
    string organizerId
    string title
    string city
    string venue
    string startsAt
    string status
  }
  TICKET_TIER {
    string id
    string eventId
    string name
    integer priceInKobo
    integer capacity
    integer sold
  }
  BOOKING {
    string id
    string reference
    string bookedBy
    string tierId
    string status
    integer amountInKobo
    integer refundedAmountInKobo
    string createdAt
    string paidAt
  }
  TICKET {
    string id
    string bookingId
    string firstName
    string lastName
    string holderName
    integer priceInKobo
    string status
    string issuedAt
    string usedAt
    string refundedAt
  }
```

Each booking contains separately identified tickets. SQLite persists user IDs and ticket records, including individual refund status. Authentication and full user profiles arrive in Build 7.

## Booking and ticket life cycles

```mermaid
stateDiagram-v2
  state "Booking lifecycle" as Booking {
    [*] --> pending
    pending --> paid
    pending --> cancelled
    paid --> checked_in: all non-refunded tickets checked in
    paid --> refunded: all tickets refunded
    paid --> cancelled
  }
  state "Ticket lifecycle (each ticket has its own ID)" as Ticket {
    [*] --> valid
    valid --> refunded: this ticket is returned
    valid --> cancelled: booking cancelled
    valid --> checked_in: this ticket is scanned
  }
```

- Booking moves are `pending -> paid|cancelled` and `paid -> checked_in|refunded|cancelled`. `cancelled`, `refunded`, and `checked_in` are final booking states.
- A ticket moves from `valid` to `refunded`, `cancelled`, or `checked_in`; those ticket states are final.
- Returning one ticket changes only that ticket to `refunded`; the other tickets remain `valid`, and the booking remains `paid` until a full-booking transition occurs.
- A booking is `checked_in` only after every ticket that has not been refunded is checked in. A scan of one ticket is a ticket-level change, not an immediate booking-level change.
- Builds 3–5 validate these moves. Build 4 pays for the booking total in kobo and supports simulated partial ticket refunds; Build 5 persists these records and reserves capacity with a conditional atomic database update. Actual payment refunds and ticket scanning are later-build behavior.

The server runs locally on the development computer and listens on `PORT` (default `3000`); it does not provision or configure a hosting machine. Build 4 adds the event and booking API routes while continuing to serve `/health` and static files.
