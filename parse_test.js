const { parser } = require("@lezer/markdown");
const { tags } = require("@lezer/highlight");
const { highlightTree } = require("@lezer/highlight");

const doc = "| Header | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |";
const tree = parser.parse(doc);

// Custom highlight mapping to extract tags
let cursor = tree.cursor();
do {
  if (cursor.type.isError) continue;
  console.log(`Node: ${cursor.name}, from: ${cursor.from}, to: ${cursor.to}, text: "${doc.slice(cursor.from, cursor.to)}"`);
} while (cursor.next());
