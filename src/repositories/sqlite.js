import { DomainError } from "../domain/errors.js";
import { openDatabase } from "../db/connection.js";

function eventFromRow(row, tierIds = []) {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
    tierIds,
  };
}

function tierFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceInKobo: Number(row.price_in_kobo),
    capacity: Number(row.capacity),
    sold: Number(row.sold),
  };
}

function ticketFromRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    holderName: row.holder_name,
    priceInKobo: Number(row.price_in_kobo),
    status: row.status,
    issuedAt: row.issued_at,
    usedAt: row.used_at,
    ...(row.refunded_at === null ? {} : { refundedAt: row.refunded_at }),
  };
}

function insertUser(database, userId) {
  database.prepare(
    "INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)",
  ).run(userId, new Date().toISOString());
}

function insertBooking(database, booking) {
  database.prepare(`
    INSERT INTO bookings (
      id, reference, booked_by, tier_id, status, created_at, paid_at,
      amount_in_kobo, refunded_amount_in_kobo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      reference = excluded.reference,
      booked_by = excluded.booked_by,
      tier_id = excluded.tier_id,
      status = excluded.status,
      created_at = excluded.created_at,
      paid_at = excluded.paid_at,
      amount_in_kobo = excluded.amount_in_kobo,
      refunded_amount_in_kobo = excluded.refunded_amount_in_kobo
  `).run(
    booking.id,
    booking.reference,
    booking.bookedBy,
    booking.tierId,
    booking.status,
    booking.createdAt,
    booking.paidAt ?? null,
    booking.amountInKobo,
    booking.refundedAmountInKobo ?? 0,
  );

  database.prepare("DELETE FROM tickets WHERE booking_id = ?").run(booking.id);
  const insertTicket = database.prepare(`
    INSERT INTO tickets (
      id, booking_id, first_name, last_name, holder_name, price_in_kobo,
      status, issued_at, used_at, refunded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ticket of booking.tickets) {
    insertTicket.run(
      ticket.id,
      booking.id,
      ticket.firstName,
      ticket.lastName,
      ticket.holderName,
      ticket.priceInKobo,
      ticket.status,
      ticket.issuedAt,
      ticket.usedAt ?? null,
      ticket.refundedAt ?? null,
    );
  }
}

function inTransaction(database, operation) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function createSqliteRepository({ filename } = {}) {
  const database = openDatabase(filename);

  function getTier(tierId) {
    const row = database.prepare("SELECT * FROM ticket_tiers WHERE id = ?").get(tierId);
    return row ? tierFromRow(row) : undefined;
  }

  function listTiersForEvent(eventId) {
    return database.prepare(
      "SELECT * FROM ticket_tiers WHERE event_id = ?",
    ).all(eventId).map(tierFromRow);
  }

  function saveBooking(booking) {
    return inTransaction(database, () => {
      insertUser(database, booking.bookedBy);
      insertBooking(database, booking);
      return booking;
    });
  }

  return {
    async saveEvent(event) {
      insertUser(database, event.organizerId);
      database.prepare(`
        INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          organizer_id = excluded.organizer_id,
          title = excluded.title,
          city = excluded.city,
          venue = excluded.venue,
          starts_at = excluded.starts_at,
          status = excluded.status
      `).run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status,
      );
      return event;
    },

    async getEvent(eventId) {
      const row = database.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
      return row ? eventFromRow(row, listTiersForEvent(eventId).map((tier) => tier.id)) : undefined;
    },

    async listEvents() {
      return database.prepare("SELECT * FROM events").all().map((row) =>
        eventFromRow(row, listTiersForEvent(row.id).map((tier) => tier.id)));
    },

    async saveTier(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price_in_kobo, capacity, sold)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          event_id = excluded.event_id,
          name = excluded.name,
          price_in_kobo = excluded.price_in_kobo,
          capacity = excluded.capacity,
          sold = excluded.sold
      `).run(tier.id, tier.eventId, tier.name, tier.priceInKobo, tier.capacity, tier.sold);
      return tier;
    },

    async getTier(tierId) {
      return getTier(tierId);
    },

    async listTiersForEvent(eventId) {
      return listTiersForEvent(eventId);
    },

    async saveBooking(booking) {
      return saveBooking(booking);
    },

    async saveBookingWithSeatReservation(booking, quantity) {
      return inTransaction(database, () => {
        insertUser(database, booking.bookedBy);
        const result = database.prepare(`
          UPDATE ticket_tiers
          SET sold = sold + ?
          WHERE id = ? AND sold + ? <= capacity
        `).run(quantity, booking.tierId, quantity);
        if (Number(result.changes) !== 1) return false;
        insertBooking(database, booking);
        return true;
      });
    },

    async releaseSeats(tierId, quantity) {
      const result = database.prepare(`
        UPDATE ticket_tiers
        SET sold = sold - ?
        WHERE id = ? AND sold >= ?
      `).run(quantity, tierId, quantity);
      if (Number(result.changes) !== 1) {
        throw new DomainError("INVALID_STATE", "Cannot release more seats than are currently sold");
      }
      return getTier(tierId);
    },

    async getBookingByReference(reference) {
      const row = database.prepare(
        "SELECT * FROM bookings WHERE reference = ?",
      ).get(reference);
      if (!row) return undefined;
      const tickets = database.prepare(
        "SELECT * FROM tickets WHERE booking_id = ?",
      ).all(row.id).map(ticketFromRow);
      return {
        id: row.id,
        reference: row.reference,
        bookedBy: row.booked_by,
        tierId: row.tier_id,
        status: row.status,
        createdAt: row.created_at,
        ...(row.paid_at === null ? {} : { paidAt: row.paid_at }),
        amountInKobo: Number(row.amount_in_kobo),
        refundedAmountInKobo: Number(row.refunded_amount_in_kobo),
        tickets,
      };
    },

    close() {
      database.close();
    },
  };
}
