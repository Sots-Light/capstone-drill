import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[randomInt(ALPHABET.length)];
  }
  return result;
}

export function newId() {
  return randomChars(10);
}

export function newReference() {
  return `${randomChars(4)}-${randomChars(4)}`;
}