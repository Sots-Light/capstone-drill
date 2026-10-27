# Build 3 architecture and state diagrams

## Application layers

```mermaid
flowchart TD
  Client[Browser or API client] --> Routes[HTTP router and route handlers]
  Routes --> Services[Application services]
  Services --> Rules[Domain rules]
  Services --> Repositories[Repositories and data access]
  Repositories --> Data[(In-memory store now; SQLite in Build 5)]
```

- **Routes** may read HTTP input, call services, and format HTTP responses; they may not contain booking rules or access storage directly.
- **Services** may coordinate use cases and repositories; they may not decide domain rules themselves or depend on HTTP response objects.
- **Domain rules** may validate and decide business state changes; they may not perform HTTP, file, or database I/O.
- **Repositories** may read and write data; they may not decide business rules or call routes.

Build 3 introduces the router and server skeleton. The service and repository layers are architectural destinations for later builds, not implementations added in this build.

## HTTP request and data flow

```mermaid
flowchart LR
  Client["Browser or phone<br/>HTTP client"] -->|"1. HTTP request<br/>GET /health or GET /"| Node["Node.js server<br/>src/server.js"]
  Config["PORT environment variable<br/>default: 3000"] -.->|"listens on"| Node
  Node --> App["HTTP app<br/>src/http/app.js"]
  App --> Router{"Router<br/>method + path"}

  Router -->|"GET /health"| Health["Health route"]
  Health -->|"200 JSON<br/>{ status: ok }"| App

  Router -->|"GET /, GET /index.html<br/>and static assets"| Static["Static file handler"]
  Static -->|"safe path lookup"| Public[("public/<br/>index.html and assets")]
  Public -->|"file contents"| Static
  Static -->|"200 file response"| App

  Router -->|"/api/*"| Api{"API route registered?"}
  Api -->|"No: Build 3 has no business API routes yet"| NotFound["JSON 404<br/>NOT_FOUND"]
  Api -->|"Yes: future Build 4 routes"| Future["Future services<br/>and repositories"]
  Future -.->|"business rules"| Domain["Domain rules<br/>booking and ticket state machines"]
  Future -.->|"data access in later builds"| Store[("In-memory store now<br/>SQLite repository in Build 5")]
  Domain -.->|"allowed state change"| Future
  Store -.->|"data result"| Future
  Future -->|"JSON response"| App

  App -->|"malformed JSON"| BadRequest["JSON 400<br/>BAD_JSON"]
  NotFound -->|"error response"| App
  BadRequest -->|"error response"| App
  App -->|"2. HTTP response"| Client

  classDef client fill:#dae8fc,stroke:#6c8ebf,color:#000;
  classDef server fill:#d5e8d4,stroke:#82b366,color:#000;
  classDef route fill:#fff2cc,stroke:#d6b656,color:#000;
  classDef future fill:#e1d5e7,stroke:#9673a6,color:#000;
  classDef error fill:#f8cecc,stroke:#b85450,color:#000;
  class Client client;
  class Node,App server;
  class Router,Health,Static,Public,Api route;
  class Future,Domain,Store future;
  class NotFound,BadRequest error;
```

Solid arrows show behavior implemented in Build 3. Dashed arrows show connections planned for later builds. The client can be your browser on the same computer during development; this does not require a separate Windows Server machine.

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
  }
  TICKET {
    string id
    string holderName
    integer priceInKobo
    string status
  }
```

Each booking contains separately identified tickets. The current in-memory project stores users as IDs rather than full user records; authentication and user storage arrive in Build 7.

## Booking and ticket life cycles

```mermaid
stateDiagram-v2
  state "Booking lifecycle" as Booking {
    [*] --> pending
    pending --> paid
    pending --> cancelled
    paid --> checked_in: all non-refunded tickets checked in
    paid --> refunded: full booking refund
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
- Build 3 documents and validates these moves. Payment, partial refunds, actual ticket scanning, and issuing tickets through an API are later-build behavior.

`GET /health` is the only application route in this skeleton. The server runs locally on the development computer and listens on `PORT` (default `3000`); it does not provision or configure a hosting machine.
