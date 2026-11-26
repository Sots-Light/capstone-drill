import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBooking, getEvent, listEvents, pay } from "../public/js/api.js";
import { formatCountdown, formatMoney } from "../public/js/ui.js";

describe("Build 6 mock frontend API", () => {
  it("lists and filters mock events using the same kobo and search rules", async () => {
    const { events } = await listEvents({
      q: "HALLELUYAH",
      city: "lagos",
      maxPriceInKobo: 500000,
      sort: "price",
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].title, "Halleluyah Exam");
    assert.equal(events[0].tiers[0].priceInKobo, 500000);
  });

  it("returns an event with its ticket tiers", async () => {
    const { event } = await getEvent("evt-halleluyah-exam");
    assert.equal(event.title, "Halleluyah Exam");
    assert.deepEqual(event.tiers.map((tier) => tier.name), ["General", "VIP"]);
  });

  it("marks the sold-out tier as unavailable for booking", async () => {
    const { event } = await getEvent("evt-halleluyah-exam");
    const soldOutTier = event.tiers.find((tier) => tier.id === "tier-halleluyah-vip");
    assert.equal(soldOutTier.seatsLeft, 0);
    await assert.rejects(
      createBooking({
        tierId: soldOutTier.id,
        tickets: [{ firstName: "Ada", lastName: "Obi" }],
      }),
      { code: "SOLD_OUT", status: 409 },
    );
  });

  it("creates named ticket IDs and allows retry after a declined mock payment", async () => {
    const booking = await createBooking({
      tierId: "tier-halleluyah-general",
      tickets: [
        { firstName: "Build6Test", lastName: "One" },
        { firstName: "Build6Test", lastName: "Two" },
      ],
    });
    assert.equal(booking.status, "pending");
    assert.equal(booking.amountInKobo, 1000000);
    assert.equal(booking.tickets.length, 2);
    assert.notEqual(booking.tickets[0].id, booking.tickets[1].id);
    assert.equal(booking.tickets[1].holderName, "Build6Test Two");

    await assert.rejects(
      pay(booking.reference, "mock-card-declined"),
      { code: "PAYMENT_DECLINED", status: 402 },
    );
    const paid = await pay(booking.reference, "mock-card-approved");
    assert.equal(paid.status, "paid");
    assert.equal(paid.tickets[0].firstName, "Build6Test");
  });

  it("formats kobo as naira and countdown values as minutes and seconds", () => {
    assert.equal(formatMoney(250000), "₦2,500");
    assert.equal(formatMoney(500050), "₦5,000.50");
    assert.equal(formatCountdown(600), "10:00");
    assert.equal(formatCountdown(9), "00:09");
  });
});
