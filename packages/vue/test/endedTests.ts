let count = 0;

/** The number of tests of the page that ended. `test/setup.ts` counts each end. */
export function endedTests() {
  return count;
}

export function countEndedTest() {
  count += 1;
}
