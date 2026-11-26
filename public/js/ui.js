export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
  const items = [].concat(children).filter(
    (child) => child !== null && child !== undefined && child !== false,
  );
  node.append(...items);
  return node;
}

export function clear(node) {
  node.replaceChildren();
}

export function formatMoney(amountInKobo) {
  if (!Number.isSafeInteger(amountInKobo) || amountInKobo < 0) {
    throw new TypeError("Money must be a non-negative whole number of kobo");
  }
  const amountInNaira = amountInKobo / 100;
  const fractionDigits = amountInKobo % 100 === 0 ? 0 : 2;
  return `₦${amountInNaira.toLocaleString("en-NG", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
