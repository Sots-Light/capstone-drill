import * as api from "../api.js";
import { clear, el, formatCountdown, formatDate, formatMoney } from "../ui.js";

const page = document.querySelector("#page");
const eventId = new URLSearchParams(location.search).get("id");
let countdownTimer;

function showPageError(message) {
  clear(page);
  page.append(
    el("p", { class: "error-message", role: "alert", text: message }),
    el("a", { class: "text-link", href: "/", text: "Back to events" }),
  );
}

async function showEvent(notice = "") {
  clearInterval(countdownTimer);
  clear(page);
  page.append(el("p", { class: "status", role: "status", text: "Loading event…" }));

  let event;
  try {
    ({ event } = await api.getEvent(eventId));
  } catch (error) {
    showPageError(error.code === "NOT_FOUND"
      ? "We could not find that event."
      : `Could not load the event: ${error.message}`);
    return;
  }

  document.title = `${event.title} | TicketDrill`;
  page.replaceChildren(
    el("a", { class: "back-link", href: "/", text: "← All events" }),
    el("section", { class: "event-hero" }, [
      el("p", { class: "eyebrow", text: `${event.city} · ${event.venue}` }),
      el("h1", { text: event.title }),
      el("p", { class: "event-date hero-date", text: formatDate(event.startsAt) }),
    ]),
    el("p", { id: "notice", class: "error-message", role: "alert", text: notice }),
    el("section", { "aria-labelledby": "tickets-heading" }, [
      el("div", { class: "section-heading" }, [
        el("h2", { id: "tickets-heading", text: "Choose your tickets" }),
        el("p", { class: "section-note", text: "Add each ticket holder’s name before checkout." }),
      ]),
      el("ul", { class: "tier-list" }, event.tiers.map((tier) => tierCard(event, tier))),
    ]),
    el("section", {
      id: "checkout",
      class: "checkout-panel",
      "aria-live": "polite",
      "aria-labelledby": "checkout-heading",
    }),
  );
}

function tierCard(event, tier) {
  const soldOut = tier.seatsLeft === 0;
  const maximumQuantity = Math.min(10, tier.seatsLeft);
  const quantityId = `quantity-${tier.id}`;
  const attendeeFields = el("div", { class: "attendee-fields" });
  const error = el("p", { class: "error-message", role: "alert", text: "" });
  const submit = el("button", {
    type: "submit",
    class: "button button-primary",
    disabled: soldOut,
    text: soldOut ? "Sold out" : "Continue to checkout",
  });
  const quantity = el("input", {
    id: quantityId,
    name: "quantity",
    type: "number",
    min: 1,
    max: maximumQuantity,
    value: soldOut ? 0 : 1,
    required: true,
    disabled: soldOut,
  });

  function renderAttendeeFields(count) {
    clear(attendeeFields);
    for (let index = 0; index < count; index += 1) {
      const firstId = `tier-${tier.id}-attendee-${index + 1}-first`;
      const lastId = `tier-${tier.id}-attendee-${index + 1}-last`;
      attendeeFields.append(
        el("fieldset", { class: "attendee-fieldset" }, [
          el("legend", { text: `Ticket ${index + 1} attendee` }),
          el("div", { class: "name-fields" }, [
            el("div", { class: "field" }, [
              el("label", { for: firstId, text: "First name" }),
              el("input", {
                id: firstId,
                name: `firstName-${index}`,
                autocomplete: "given-name",
                required: true,
              }),
            ]),
            el("div", { class: "field" }, [
              el("label", { for: lastId, text: "Last name" }),
              el("input", {
                id: lastId,
                name: `lastName-${index}`,
                autocomplete: "family-name",
                required: true,
              }),
            ]),
          ]),
        ]),
      );
    }
  }

  if (!soldOut) renderAttendeeFields(1);
  quantity.addEventListener("input", () => {
    const count = Number(quantity.value);
    if (Number.isInteger(count) && count >= 1 && count <= maximumQuantity) {
      renderAttendeeFields(count);
      error.textContent = "";
    }
  });

  const form = el("form", { class: "tier-form" }, [
    el("div", { class: "tier-summary" }, [
      el("div", {}, [
        el("h3", { text: tier.name }),
        el("p", { class: "tier-price", text: formatMoney(tier.priceInKobo) }),
      ]),
      soldOut
        ? el("span", { class: "badge badge-soldout", text: "Sold out" })
        : el("span", { class: "availability", text: `${tier.seatsLeft} available` }),
    ]),
    el("div", { class: "quantity-row" }, [
      el("label", { for: quantityId, text: "Number of tickets" }),
      quantity,
      el("span", {
        class: "section-note",
        text: soldOut ? "This tier has no seats left." : `Maximum ${maximumQuantity} per booking`,
      }),
    ]),
    attendeeFields,
    error,
    submit,
  ]);

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const count = Number(quantity.value);
    if (!Number.isInteger(count) || count < 1 || count > maximumQuantity) {
      error.textContent = `Choose between 1 and ${maximumQuantity} tickets.`;
      return;
    }
    const formData = new FormData(form);
    const tickets = Array.from({ length: count }, (_, index) => ({
      firstName: String(formData.get(`firstName-${index}`) ?? "").trim(),
      lastName: String(formData.get(`lastName-${index}`) ?? "").trim(),
    }));
    if (tickets.some((ticket) => !ticket.firstName || !ticket.lastName)) {
      error.textContent = "Enter a first and last name for every ticket.";
      return;
    }

    error.textContent = "";
    submitButtonDisabled(form, true);
    try {
      const booking = await api.createBooking({ tierId: tier.id, tickets });
      showCheckout(event, tier, booking);
    } catch (requestError) {
      if (requestError.code === "SOLD_OUT") {
        await showEvent(`${requestError.message}. We refreshed the availability.`);
      } else {
        error.textContent = requestError.message;
        submitButtonDisabled(form, false);
      }
    }
  });

  return el("li", { class: `tier-card${soldOut ? " tier-soldout" : ""}` }, [form]);
}

function submitButtonDisabled(form, disabled) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = disabled;
}

function showCheckout(event, tier, booking) {
  const checkout = document.querySelector("#checkout");
  clear(checkout);
  checkout.classList.add("checkout-active");

  const countdown = el("p", { class: "countdown", role: "timer", "aria-live": "off" });
  const error = el("p", { class: "error-message", role: "alert", text: "" });
  const cardId = "mock-card";
  const cardChoice = el("select", { id: cardId, name: "paymentChoice" }, [
    el("option", { value: "mock-card-approved", text: "Test payment — approved" }),
    el("option", { value: "mock-card-declined", text: "Test payment — declined" }),
  ]);
  const payButton = el("button", {
    type: "submit",
    class: "button button-primary",
    text: `Pay ${formatMoney(booking.amountInKobo)}`,
  });
  const paymentForm = el("form", { class: "payment-form" }, [
    el("div", { class: "field" }, [
      el("label", { for: cardId, text: "Mock payment result" }),
      cardChoice,
    ]),
    payButton,
  ]);
  let holdExpired = false;
  const holdUntil = Date.parse(booking.holdUntil);

  function updateCountdown() {
    const secondsLeft = Math.ceil((holdUntil - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      holdExpired = true;
      clearInterval(countdownTimer);
      countdown.textContent = "Your ticket hold has expired.";
      error.textContent = "The seats are no longer held. Start again to choose available tickets.";
      payButton.disabled = true;
      checkout.append(el("a", {
        class: "text-link",
        href: `/event.html?id=${encodeURIComponent(event.id)}`,
        text: "Choose tickets again",
      }));
      return;
    }
    countdown.textContent = `Seats held for ${formatCountdown(secondsLeft)}`;
  }

  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
  paymentForm.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    if (holdExpired) return;
    payButton.disabled = true;
    error.textContent = "";
    try {
      const paidBooking = await api.pay(booking.reference, cardChoice.value);
      clearInterval(countdownTimer);
      showConfirmation(event, tier, paidBooking);
    } catch (paymentError) {
      error.textContent = paymentError.code === "PAYMENT_DECLINED"
        ? "The test payment was declined. Choose the approved test option or try again."
        : `Payment failed: ${paymentError.message}`;
      payButton.disabled = false;
    }
  });

  checkout.append(
    el("p", { class: "eyebrow", text: "Almost there" }),
    el("h2", { id: "checkout-heading", text: "Secure your tickets" }),
    el("p", {
      class: "checkout-description",
      text: `${booking.tickets.length} ticket${booking.tickets.length === 1 ? "" : "s"} · ${tier.name} · ${event.title}`,
    }),
    el("ul", { class: "checkout-attendees" }, booking.tickets.map((ticket) =>
      el("li", { text: `${ticket.firstName} ${ticket.lastName}` }))),
    el("p", { class: "checkout-total", text: `Total ${formatMoney(booking.amountInKobo)}` }),
    countdown,
    paymentForm,
    error,
    el("p", { class: "fine-print", text: "Demo only. No real card details or money are used." }),
  );
  checkout.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showConfirmation(event, tier, booking) {
  clearInterval(countdownTimer);
  clear(page);
  page.append(
    el("section", { class: "confirmation-card" }, [
      el("p", { class: "eyebrow", text: "Booking complete" }),
      el("h1", { text: "You’re all set." }),
      el("p", { class: "lead", text: `${event.title} · ${formatDate(event.startsAt)}` }),
      el("p", {
        class: "checkout-total",
        text: `Paid ${formatMoney(booking.amountInKobo)} · ${tier.name}`,
      }),
      el("p", { class: "booking-reference", text: `Booking reference: ${booking.reference}` }),
      el("h2", { text: "Tickets and attendees" }),
      el("ul", { class: "confirmation-tickets" }, booking.tickets.map((ticket) =>
        el("li", { class: "confirmation-ticket" }, [
          el("span", { class: "ticket-holder", text: `${ticket.firstName} ${ticket.lastName}` }),
          el("span", { class: "ticket-id", text: `Ticket ID: ${ticket.id}` }),
        ]))),
      el("p", {
        class: "fine-print",
        text: "This confirmation is part of a mock-data learning demo. No real payment was taken.",
      }),
      el("a", { class: "button button-primary button-link", href: "/", text: "Browse more events" }),
    ]),
  );
}

if (!eventId) {
  showPageError("No event was selected.");
} else {
  showEvent();
}
