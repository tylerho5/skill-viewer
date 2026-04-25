import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../../src/tui/render/markdown.js";

test("renders h1 with yellow", () => {
  const out = renderMarkdown("# Hello");
  assert.match(out, /\{yellow-fg\}Hello/);
  assert.match(out, /\{bold\}/);
});

test("fenced code block becomes gray block", () => {
  const out = renderMarkdown("```\nconst x = 1;\n```");
  assert.match(out, /\{gray-fg\}const x = 1;/);
});

test("inline code becomes cyan", () => {
  const out = renderMarkdown("Use `npm test`");
  assert.match(out, /\{cyan-fg\}npm test\{\/\}/);
});

test("bullet list indents with bullet char", () => {
  const out = renderMarkdown("- one\n- two");
  assert.match(out, /• one/);
  assert.match(out, /• two/);
});

test("escapes blessed braces in source", () => {
  const out = renderMarkdown("literal {text}");
  assert.match(out, /\{open\}text\{close\}/);
});
