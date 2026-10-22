import { DomainError } from "./errors.js";

export function parseIsoDate(value, field, { endOfDay = false } = {}) {
  if (typeof value !== "string") {
    throw new DomainError("VALIDATION", `${field} must be a valid ISO date`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) {
    throw new DomainError("VALIDATION", `${field} must be a valid ISO date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new DomainError("VALIDATION", `${field} must be a real calendar date`);
  }

  if (match[4] !== undefined) {
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) {
      throw new DomainError("VALIDATION", `${field} must be a valid ISO date`);
    }
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new DomainError("VALIDATION", `${field} must be a valid ISO date`);
  }

  const isDateOnly = match[4] === undefined;
  return endOfDay && isDateOnly ? timestamp + 24 * 60 * 60 * 1000 - 1 : timestamp;
}
