import { createSqliteRepository } from "../src/repositories/sqlite.js";

const repository = createSqliteRepository();

try {
  const existingEvents = await repository.listEvents();
  if (existingEvents.length > 0) {
    console.log("Database already contains event data; seed skipped.");
  } else {
    const event = {
      id: "seed-event-lagos-meetup",
      organizerId: "seed-organizer",
      title: "Seeded Lagos Meetup",
      city: "Lagos",
      venue: "City Hall",
      startsAt: "2030-01-05T16:00:00.000Z",
      status: "published",
      tierIds: ["seed-tier-general"],
    };
    const tier = {
      id: "seed-tier-general",
      eventId: event.id,
      name: "General",
      priceInKobo: 500000,
      capacity: 100,
      sold: 0,
    };
    await repository.saveEvent(event);
    await repository.saveTier(tier);
    console.log("Seeded one published event and its ticket tier.");
  }
} finally {
  repository.close();
}
