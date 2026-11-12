import assert from "node:assert/strict";
import { test } from "node:test";
import { allowsRange, parseByteRange } from "../lib/http-range.ts";

for (const [header, expected] of [
  ["bytes=0-9", { start: 0, end: 9 }],
  ["bytes=40-", { start: 40, end: 99 }],
  ["bytes=-10", { start: 90, end: 99 }],
  ["bytes=-1000", { start: 0, end: 99 }],
  ["bytes=90-200", { start: 90, end: 99 }],
  ["bytes=0-999999999999999999999999999999", { start: 0, end: 99 }],
  [null, null], ["items=0-9", null], ["bytes=0-9,20-29", null],
  ["bytes=100-", "invalid"], ["bytes=20-10", "invalid"],
  ["bytes=-0", "invalid"], ["bytes=-", "invalid"], ["bytes=abc", "invalid"],
  ["bytes=999999999999999999999999999999-", "invalid"],
]) {
  test(`handles the byte range ${JSON.stringify(header)}`, () => assert.deepEqual(parseByteRange(header, 100), expected));
}

test("rejects byte ranges for empty files", () => assert.equal(parseByteRange("bytes=0-", 0), "invalid"));
test("honors If-Range strong validators and modification dates", () => {
  const modified = "2026-01-01T12:00:00.500Z";
  assert.equal(allowsRange(null, '"version"', modified), true);
  assert.equal(allowsRange('"version"', '"version"', modified), true);
  assert.equal(allowsRange('"older"', '"version"', modified), false);
  assert.equal(allowsRange('W/"version"', '"version"', modified), false);
  assert.equal(allowsRange("Thu, 01 Jan 2026 12:00:00 GMT", '"version"', modified), true);
  assert.equal(allowsRange("Thu, 01 Jan 2026 11:59:59 GMT", '"version"', modified), false);
  assert.equal(allowsRange("invalid", '"version"', modified), false);
});
