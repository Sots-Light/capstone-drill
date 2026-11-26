import * as api from "../api.js";
import { clear, el, formatDate, formatMoney } from "../ui.js";

const form = document.querySelector("#filters");
const eventList = document.querySelector("#events");
const status = document.querySelector("#status");
const citySelect = document.querySelector("#city");

function readFilters() {
  const formData = new FormData(form);
  const maxNaira = formData.get("maxPrice");
  return {
    q: String(formData.get("q") ?? ""),
    city: String(formData.get("city") ?? ""),
    from: String(formData.get("from") ?? "") || undefined,
    to: String(formData.get("to") ?? "") || undefined,
    maxPriceInKobo: maxNaira === "" ? undefined : Math.round(Number(maxNaira) * 100),
    onlyAvailable: formData.get("onlyAvailable") === "on",
    sort: String(formData.get("sort") ?? "date"),
  };
}

function eventCard(event) {
  const lowestPrice = Math.min(...event.tiers.map((tier) => tier.priceInKobo));
  const availableSeats = event.tiers.reduce((sum, tier) => sum + tier.seatsLeft, 0);
  const soldOut = availableSeats === 0;
  return el("li", { class: "event-card" }, [
    el("div", { class: "card-topline" }, [
      el("span", { class: "city-pill", text: event.city }),
      soldOut
        ? el("span", { class: "badge badge-soldout", text: "Sold out" })
        : el("span", { class: "availability", text: `${availableSeats} seats left` }),
    ]),
    el("h3", {}, [
      el("a", {
        href: `/event.html?id=${encodeURIComponent(event.id)}`,
        text: event.title,
      }),
    ]),
    el("p", { class: "venue", text: event.venue }),
    el("p", { class: "event-date", text: formatDate(event.startsAt) }),
    el("div", { class: "card-bottom" }, [
      el("p", { class: "starting-price", text: `From ${formatMoney(lowestPrice)}` }),
      el("a", {
        class: "text-link",
        href: `/event.html?id=${encodeURIComponent(event.id)}`,
        text: "View event",
        "aria-label": `View ${event.title}`,
      }),
    ]),
  ]);
}

async function loadEvents() {
  status.textContent = "Finding events…";
  clear(eventList);
  try {
    const { events } = await api.listEvents(readFilters());
    if (events.length === 0) {
      status.textContent = "No events match those filters. Try changing your search.";
      return;
    }
    status.textContent = `${events.length} event${events.length === 1 ? "" : "s"} found`;
    eventList.append(...events.map(eventCard));
  } catch (error) {
    status.textContent = `Could not load events: ${error.message}`;
  }
}

async function populateCities() {
  const { events } = await api.listEvents();
  const cities = [...new Set(events.map((event) => event.city))]
    .sort((first, second) => first.localeCompare(second));
  citySelect.append(...cities.map((city) => el("option", { value: city, text: city })));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadEvents();
});
for (const control of ["city", "from", "to", "sort", "onlyAvailable"]) {
  document.querySelector(`#${control}`).addEventListener("change", loadEvents);
}

try {
  await populateCities();
  await loadEvents();
} catch (error) {
  status.textContent = `Could not load event filters: ${error.message}`;
}
