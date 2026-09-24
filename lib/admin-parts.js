// lib/admin-parts.js
//
// Pure part-number rules for a series (no I/O, so they're easy to test).

/**
 * When a message leaves a series, the numbers above it move up by one so it
 * doesn't leave a hole: remove part 1 and the old part 2 becomes part 1.
 * If another message still holds the removed number (a morning/evening twin),
 * nothing moves. Numbers below it never change.
 *
 * `rows` are the messages that remain: [{ id, part_number }].
 * Returns [{ id, from, to }], lowest number first.
 */
export function gapClosingMoves(rows, removed) {
  if (!Number.isInteger(removed) || rows.some((r) => r.part_number === removed)) return [];
  return rows
    .filter((r) => r.part_number > removed)
    .sort((a, b) => a.part_number - b.part_number)
    .map((r) => ({ id: r.id, from: r.part_number, to: r.part_number - 1 }));
}
