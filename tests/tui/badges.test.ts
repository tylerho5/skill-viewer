import test from "node:test";
import assert from "node:assert/strict";
import { ageLabel, truncate } from "../../src/tui/render/badges.js";

test("ageLabel: today is green", () => {
  const a = ageLabel(0);
  assert.equal(a.text, "today");
  assert.equal(a.color, "green");
});

test("ageLabel: 10 days is yellow", () => {
  const a = ageLabel(10);
  assert.equal(a.text, "10d");
  assert.equal(a.color, "yellow");
});

test("ageLabel: 60 days is red and in months", () => {
  const a = ageLabel(60);
  assert.equal(a.text, "2mo");
  assert.equal(a.color, "red");
});

test("truncate: leaves short strings alone", () => {
  assert.equal(truncate("abc", 10), "abc");
});

test("truncate: appends ellipsis", () => {
  assert.equal(truncate("abcdefg", 4), "abc…");
});
