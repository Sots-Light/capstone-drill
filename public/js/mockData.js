function tier(id, name, priceInKobo, capacity, sold) {
  return {
    id,
    name,
    priceInKobo,
    capacity,
    sold,
    seatsLeft: capacity - sold,
  };
}

export const mockEvents = [
  {
    id: "evt-halleluyah-exam",
    title: "Halleluyah Exam",
    city: "Lagos",
    venue: "City Hall",
    startsAt: "2026-12-05T16:00:00.000Z",
    status: "published",
    tiers: [
      tier("tier-halleluyah-general", "General", 500000, 30, 8),
      tier("tier-halleluyah-vip", "VIP", 1500000, 5, 5),
    ],
  },
  {
    id: "evt-abuja-jazz",
    title: "Abuja Jazz Night",
    city: "Abuja",
    venue: "Transcorp Hilton",
    startsAt: "2026-12-12T18:00:00.000Z",
    status: "published",
    tiers: [
      tier("tier-jazz-standard", "Standard", 800000, 120, 45),
      tier("tier-jazz-table", "Table for four", 4000000, 12, 3),
    ],
  },
  {
    id: "evt-ibadan-food-fair",
    title: "Ibadan Food Fair",
    city: "Ibadan",
    venue: "Cultural Centre Mokola",
    startsAt: "2026-12-19T09:00:00.000Z",
    status: "published",
    tiers: [tier("tier-food-entry", "Entry", 250000, 300, 75)],
  },
  {
    id: "evt-lagos-comedy",
    title: "Lagos Comedy Night",
    city: "Lagos",
    venue: "Muson Centre",
    startsAt: "2026-12-26T17:30:00.000Z",
    status: "published",
    tiers: [
      tier("tier-comedy-regular", "Regular", 1000000, 40, 0),
      tier("tier-comedy-front", "Front row", 2500000, 8, 6),
    ],
  },
  {
    id: "evt-sold-out-concert",
    title: "Sold Out Live Concert",
    city: "Port Harcourt",
    venue: "Hotel Presidential",
    startsAt: "2027-01-09T19:00:00.000Z",
    status: "published",
    tiers: [tier("tier-concert-general", "General admission", 1200000, 50, 50)],
  },
];
