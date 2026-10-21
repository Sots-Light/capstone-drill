import { newId, newReference } from "../../src/domain/ids.js";

console.log(newId());                // 10 characters
console.log(newId().length);         // 10
console.log(newReference());         // something like K7M2-Q9XA
console.log(newReference().length);  // 9 (8 characters plus the dash)

const ids = new Set();
for (let i = 0; i < 100000; i++) ids.add(newId());
console.log(ids.size);               // 100000 (no repeats)

const refs = new Set();
for (let i = 0; i < 10000; i++) refs.add(newReference());
console.log(refs.size);              // 10000, a repeat is possible but extremely unlikely