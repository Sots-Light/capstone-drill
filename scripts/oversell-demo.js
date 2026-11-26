import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApplication } from "../src/application.js";
import { newId, newReference } from "../src/domain/ids.js";
import { createSqliteRepository } from "../src/repositories/sqlite.js";

const attendeeCount = 50;
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "capstone-oversell-"));
const repository = createSqliteRepository({
  filename: path.join(temporaryDirectory, "oversell.sqlite"),
});
let server;

async function createOneSeatTier(title) {
  const event = {
    id: newId(),
    organizerId: "demo-organizer",
    title,
    city: "Lagos",
    venue: "Demo Hall",
    startsAt: "2030-01-05T16:00:00.000Z",
    status: "published",
    tierIds: [],
  };
  await repository.saveEvent(event);
  const tier = {
    id: newId(),
    eventId: event.id,
    name: "Last seat",
    priceInKobo: 500000,
    capacity: 1,
    sold: 0,
  };
  event.tierIds.push(tier.id);
  await repository.saveTier(tier);
  return tier;
}

async function unsafeCheckThenBook(tierId, attempt) {
  const tier = await repository.getTier(tierId);
  if (tier.sold + 1 > tier.capacity) return false;

  await Promise.resolve();
  tier.sold += 1;
  await repository.saveTier(tier);
  const createdAt = new Date().toISOString();
  const firstName = `Guest${attempt}`;
  await repository.saveBooking({
    id: newId(),
    reference: newReference(),
    bookedBy: `baseline-attendee-${attempt}`,
    tierId,
    status: "pending",
    createdAt,
    amountInKobo: tier.priceInKobo,
    refundedAmountInKobo: 0,
    tickets: [{
      id: newId(),
      firstName,
      lastName: "Baseline",
      holderName: `${firstName} Baseline`,
      priceInKobo: tier.priceInKobo,
      status: "valid",
      issuedAt: createdAt,
      usedAt: null,
    }],
  });
  return true;
}

try {
  const beforeTier = await createOneSeatTier("Before atomic reservation");
  const unsafeResults = await Promise.all(
    Array.from({ length: attendeeCount }, (_, index) =>
      unsafeCheckThenBook(beforeTier.id, index + 1)),
  );
  const before = await repository.getTier(beforeTier.id);
  const beforeSuccesses = unsafeResults.filter(Boolean).length;
  console.log(
    `Before atomic fix: ${beforeSuccesses} bookings succeeded for a ${before.capacity}-seat tier; sold recorded=${before.sold}.`,
  );
  assert.ok(beforeSuccesses > 1, "The baseline check-then-book example did not reproduce overselling");

  const afterTier = await createOneSeatTier("After atomic reservation");
  const application = createApplication({ repository });
  server = application.server;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const responses = await Promise.all(
    Array.from({ length: attendeeCount }, (_, index) => fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": `fixed-attendee-${index + 1}`,
      },
      body: JSON.stringify({
        tierId: afterTier.id,
        tickets: [{ firstName: `Guest${index + 1}`, lastName: "Atomic" }],
      }),
    })),
  );
  const bodies = await Promise.all(responses.map((response) => response.json()));
  const successes = responses.filter((response) => response.status === 201).length;
  const soldOut = bodies.filter((body) => body.error?.code === "SOLD_OUT").length;
  const after = await repository.getTier(afterTier.id);

  console.log(
    `After atomic fix: ${successes} booking succeeded, ${soldOut} received SOLD_OUT; sold=${after.sold}/${after.capacity}.`,
  );
  assert.equal(successes, 1);
  assert.equal(soldOut, attendeeCount - 1);
  assert.ok(after.sold <= after.capacity);
} finally {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  repository.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
