import { DomainError } from "./errors.js";
import { parseIsoDate } from "./dates.js";
import { mergeSort } from "./sorting.js";

export function summarizeEvent(event, tiers) {
  const prices = tiers.map((tier) => tier.priceInKobo);
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    status: event.status,
    tierCount: tiers.length,
    minPriceInKobo: prices.length === 0 ? null : Math.min(...prices),
    seatsLeft: tiers.reduce((total, tier) => total + tier.capacity - tier.sold, 0),
  };
}

function requireCriteria(criteria) {
  if (criteria === null || typeof criteria !== "object" || Array.isArray(criteria)) {
    throw new DomainError("VALIDATION", "Search criteria must be an object");
  }
}

function compareText(first, second) {
  return first < second ? -1 : first > second ? 1 : 0;
}

function byTitleThenId(first, second) {
  const titleCompare = compareText(first.title.toLowerCase(), second.title.toLowerCase());
  return titleCompare || compareText(first.title, second.title) || compareText(first.id, second.id);
}

const sorters = {
  date: (first, second) => {
    const firstDay = first.startsAt.slice(0, 10);
    const secondDay = second.startsAt.slice(0, 10);
    return compareText(firstDay, secondDay) || byTitleThenId(first, second);
  },
  price: (first, second) => {
    const firstPrice = first.minPriceInKobo ?? Infinity;
    const secondPrice = second.minPriceInKobo ?? Infinity;
    return (firstPrice < secondPrice ? -1 : firstPrice > secondPrice ? 1 : 0)
      || byTitleThenId(first, second);
  },
  availability: (first, second) =>
    second.seatsLeft - first.seatsLeft || byTitleThenId(first, second),
};

export function filterEvents(summaries, criteria = {}) {
  requireCriteria(criteria);
  if (!Array.isArray(summaries)) {
    throw new DomainError("VALIDATION", "Event summaries must be an array");
  }

  const { q, city, from, to, maxPriceInKobo, onlyAvailable } = criteria;
  if (q !== undefined && typeof q !== "string") {
    throw new DomainError("VALIDATION", "Search text must be a string");
  }
  if (city !== undefined && typeof city !== "string") {
    throw new DomainError("VALIDATION", "City must be a string");
  }
  if (from !== undefined) parseIsoDate(from, "from");
  if (to !== undefined) parseIsoDate(to, "to", { endOfDay: true });
  if (
    maxPriceInKobo !== undefined
    && (!Number.isInteger(maxPriceInKobo) || maxPriceInKobo < 0)
  ) {
    throw new DomainError("VALIDATION", "maxPriceInKobo must be a non-negative whole number");
  }
  if (onlyAvailable !== undefined && typeof onlyAvailable !== "boolean") {
    throw new DomainError("VALIDATION", "onlyAvailable must be a boolean");
  }

  const searchText = q?.trim().toLowerCase();
  const wantedCity = city?.trim().toLowerCase();
  const fromTime = from === undefined ? undefined : parseIsoDate(from, "from");
  const toTime = to === undefined ? undefined : parseIsoDate(to, "to", { endOfDay: true });

  return summaries.filter((event) => {
    if (
      searchText
      && !event.title.toLowerCase().includes(searchText)
      && !event.venue.toLowerCase().includes(searchText)
    ) {
      return false;
    }
    if (wantedCity && event.city.toLowerCase() !== wantedCity) return false;

    const startsAt = Date.parse(event.startsAt);
    if (fromTime !== undefined && startsAt < fromTime) return false;
    if (toTime !== undefined && startsAt > toTime) return false;

    if (
      maxPriceInKobo !== undefined
      && (event.minPriceInKobo === null || event.minPriceInKobo > maxPriceInKobo)
    ) {
      return false;
    }
    if (onlyAvailable && event.seatsLeft <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy = "date") {
  if (!Array.isArray(summaries)) {
    throw new DomainError("VALIDATION", "Event summaries must be an array");
  }
  if (!Object.hasOwn(sorters, sortBy)) {
    throw new DomainError("VALIDATION", `Unknown sort option: ${sortBy}`);
  }
  return mergeSort(summaries, sorters[sortBy]);
}

export function searchEvents(summaries, criteria = {}, sortBy = "date") {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
