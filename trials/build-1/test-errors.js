import { DomainError } from "../../src/domain/errors.js";

const err = new DomainError("SOLD_OUT", "No seats left", { seatsLeft: 0 });
console.log(err.code);                    // SOLD_OUT
console.log(err.message);                 // No seats left
console.log(err.details);                 // { seatsLeft: 0 }
console.log(err instanceof Error);        // true
console.log(err instanceof DomainError);  // true

const plain = new DomainError("VALIDATION", "Bad input");
console.log(plain.details);               // {}