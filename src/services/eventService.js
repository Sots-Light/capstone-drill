import { DomainError } from "../domain/errors.js";
import { newId } from "../domain/ids.js";
import { parseIsoDate } from "../domain/dates.js";
import { searchEvents, summarizeEvent } from "../domain/eventSearch.js";

function requireObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError("VALIDATION", `${field} must be an object`);
  }
  return value;
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError("VALIDATION", `${field} is required`);
  }
  return value.trim();
}

function optionalText(value, field) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new DomainError("VALIDATION", `${field} must be a string`);
  }
  return value.trim();
}

function requireWholeNumber(value, field, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new DomainError("VALIDATION", `${field} must be a whole number of at least ${minimum}`);
  }
  return value;
}

async function getOwnedEvent(repository, eventId, organizerId) {
  const event = await repository.getEvent(eventId);
  if (!event) throw new DomainError("NOT_FOUND", "Event not found");
  if (event.organizerId !== organizerId) {
    throw new DomainError("FORBIDDEN", "Only the event organizer can change this event");
  }
  return event;
}

export function createEventService(repository) {
  return {
    async createEvent(organizerId, input) {
      const body = requireObject(input, "Event");
      const startsAt = new Date(parseIsoDate(body.startsAt, "startsAt")).toISOString();
      const event = {
        id: newId(),
        organizerId: requireText(organizerId, "x-user-id"),
        title: requireText(body.title, "Title"),
        city: requireText(body.city, "City"),
        venue: optionalText(body.venue, "Venue"),
        startsAt,
        status: "draft",
        tierIds: [],
      };
      return repository.saveEvent(event);
    },

    async addTier(organizerId, eventId, input) {
      const event = await getOwnedEvent(repository, eventId, requireText(organizerId, "x-user-id"));
      if (event.status !== "draft") {
        throw new DomainError("INVALID_STATE", "Ticket tiers can only be added to draft events");
      }

      const body = requireObject(input, "Ticket tier");
      const tier = {
        id: newId(),
        eventId: event.id,
        name: requireText(body.name, "Tier name"),
        priceInKobo: requireWholeNumber(body.priceInKobo, "priceInKobo", 1),
        capacity: requireWholeNumber(body.capacity, "capacity", 1),
        sold: 0,
      };
      await repository.saveTier(tier);
      event.tierIds.push(tier.id);
      await repository.saveEvent(event);
      return tier;
    },

    async publishEvent(organizerId, eventId) {
      const event = await getOwnedEvent(repository, eventId, requireText(organizerId, "x-user-id"));
      if (event.status !== "draft") {
        throw new DomainError("INVALID_STATE", "Only a draft event can be published");
      }
      const tiers = await repository.listTiersForEvent(event.id);
      if (tiers.length === 0) {
        throw new DomainError("INVALID_STATE", "Add at least one ticket tier before publishing");
      }
      event.status = "published";
      return repository.saveEvent(event);
    },

    async unpublishEvent(organizerId, eventId) {
      const event = await getOwnedEvent(repository, eventId, requireText(organizerId, "x-user-id"));
      if (event.status !== "published") {
        throw new DomainError("INVALID_STATE", "Only a published event can be unpublished");
      }
      event.status = "draft";
      return repository.saveEvent(event);
    },

    async searchEvents(criteria, sortBy) {
      const publishedEvents = (await repository.listEvents())
        .filter((event) => event.status === "published");
      const summaries = await Promise.all(publishedEvents.map(async (event) => {
        const tiers = await repository.listTiersForEvent(event.id);
        return summarizeEvent(event, tiers);
      }));
      return searchEvents(summaries, criteria, sortBy);
    },
  };
}
