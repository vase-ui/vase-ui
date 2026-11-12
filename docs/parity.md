---
order: 2
description: The state of each Vase UI family against Base UI.
---

<script setup lang="ts">
import ParityChanges from './.vitepress/components/ParityChanges.vue';
import ParityEdgeCases from './.vitepress/components/ParityEdgeCases.vue';
import ParityFamilies from './.vitepress/components/ParityFamilies.vue';
import ParityNotPorted from './.vitepress/components/ParityNotPorted.vue';
import ParitySummary from './.vitepress/components/ParitySummary.vue';
</script>

# Parity

This page shows the state of each Vase UI family against Base UI. A family is one folder of Base UI that Vase UI ports, and the column Component shows which families are components. The site build makes this page from the `parity` folder of the repository, with the functions of `pnpm parity:check`. The build fails when that check fails.

<ParitySummary />

## Families

Each source file, test and API row of Base UI needs a counterpart in Vase UI, or an exception row. A row has a reason and one of four kinds:

- `replaced`: another Vase UI test covers the thing. The row names that test.
- `not-applicable`: the thing is for something that only React has. The kind also covers an upstream file that no Base UI component imports.
- `engine`: the case does not run in one browser engine because of the browser. The row names the engine and links to a browser bug or an upstream issue.
- `waits-on`: the thing waits for an upstream file or folder that Vase UI does not have yet. The row names that path. A row that names a source file waits for the file itself.

A function that returns a different type from the type that Base UI documents has a row with the Vase UI type and the reason.

<ParityFamilies />

## Base UI changes

Each change has a state for each family that it touches:

- `mirrored`: the matched commit of the family is this commit or a later one.
- `queued`: the matched commit of the family is older than this commit.
- `not applicable`: the change does not apply to Vue. The table shows the reason.

A change that touches no family has one of two other states:

- `not started`: the change is in a part of Base UI that Vase UI has not ported yet.
- `out of scope`: Vase UI does not port the changed files. The table shows the reason when a rule names the files.

<ParityChanges />

## Edge cases

Where Vue or the browser lets us handle an edge case better than the original, we do, and we list each one with its test.

<ParityEdgeCases />

## Not ported

`parity/scope.json` lists what Vase UI does not port, each with its reason.

<ParityNotPorted />
