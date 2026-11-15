// A layout has at most five items that are not literals: the hour, the minute, the second, the day
// period and the name of the time zone. The layout joins two literals that follow each other, so it
// has at most six literals: one before the items, one after them, and one between each two of them.
export const MAX_LAYOUT_ITEMS = 11;
