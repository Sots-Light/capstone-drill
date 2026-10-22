import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeSort } from "../src/domain/sorting.js";

describe("mergeSort", () => {
  it("sorts values and returns a new array", () => {
    const original = [5, 2, 9, 1, 5, 6];
    const result = mergeSort(original);

    assert.deepEqual(result, [1, 2, 5, 5, 6, 9]);
    assert.notEqual(result, original);
    assert.deepEqual(original, [5, 2, 9, 1, 5, 6]);
  });

  it("preserves the original order of items with equal keys", () => {
    const original = [
      { name: "Ada", score: 2 },
      { name: "Tunde", score: 1 },
      { name: "Chioma", score: 2 },
      { name: "Emeka", score: 1 },
    ];
    const result = mergeSort(original, (first, second) => first.score - second.score);

    assert.deepEqual(result.map((person) => person.name), ["Tunde", "Emeka", "Ada", "Chioma"]);
    assert.deepEqual(original.map((person) => person.name), ["Ada", "Tunde", "Chioma", "Emeka"]);
  });

  it("handles an empty list and a one-item list", () => {
    assert.deepEqual(mergeSort([]), []);
    assert.deepEqual(mergeSort([42]), [42]);
  });
});
