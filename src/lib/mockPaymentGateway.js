import { DomainError } from "../domain/errors.js";

export function createMockPaymentGateway({ shouldDecline = false } = {}) {
  if (typeof shouldDecline !== "boolean" && typeof shouldDecline !== "function") {
    throw new TypeError("shouldDecline must be a boolean or a function");
  }

  return {
    async charge({ amountInKobo }) {
      if (!Number.isSafeInteger(amountInKobo) || amountInKobo < 0) {
        throw new DomainError("VALIDATION", "Payment amount must be a whole number of kobo");
      }
      const declined = typeof shouldDecline === "function"
        ? shouldDecline({ amountInKobo })
        : shouldDecline;
      return { approved: !declined, amountInKobo };
    },

    async refund({ amountInKobo }) {
      if (!Number.isSafeInteger(amountInKobo) || amountInKobo < 1) {
        throw new DomainError("VALIDATION", "Refund amount must be a positive whole number of kobo");
      }
      return { approved: true, amountInKobo, simulated: true };
    },
  };
}
