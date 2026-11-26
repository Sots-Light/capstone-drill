export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();

  return {
    async saveEvent(event) {
      events.set(event.id, event);
      return event;
    },

    async getEvent(eventId) {
      return events.get(eventId);
    },

    async listEvents() {
      return [...events.values()];
    },

    async saveTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },

    async getTier(tierId) {
      return tiers.get(tierId);
    },

    async listTiersForEvent(eventId) {
      return [...tiers.values()].filter((tier) => tier.eventId === eventId);
    },

    async saveBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },

    async getBookingByReference(reference) {
      return bookingsByReference.get(reference);
    },

    async saveBookingWithSeatReservation(booking, quantity) {
      const tier = tiers.get(booking.tierId);
      if (!tier || tier.sold + quantity > tier.capacity) return false;
      tier.sold += quantity;
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return true;
    },

    async releaseSeats(tierId, quantity) {
      const tier = tiers.get(tierId);
      if (!tier || tier.sold < quantity) return false;
      tier.sold -= quantity;
      return true;
    },
  };
}
