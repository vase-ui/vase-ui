# Vase UI

Base UI, arranged for Vue.

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3: the same unstyled, accessible components, with the same parts, data attributes and CSS variables, written as Vue components. It ships no styles. A vase should not pick your flowers.

Vase UI is an independent project. It is not affiliated with MUI.

## Our guarantee

Every Base UI component and documented API has a Vase UI counterpart.

- When Base UI publishes a release, the matching Vase UI release follows within 14 days. A Base UI major release arrives under the `next` tag in that time, and becomes `latest` in our next January release.
- The parity page shows, for every component, the Base UI commit it matches, and every Base UI change with its state: mirrored, queued, or not applicable to Vue, with the reason.
- Where Vue or the browser lets us handle an edge case better than the original, we do, and we list each one with its test.

Status: 0 of 38 components. The guarantee starts with the first full release.

## Why

React gets the good component libraries first. Vue gets to wait. We think the Vue ecosystem deserves the same love as React's, so we stopped waiting.

## What this costs

Vase UI is free. Arranging it was not.

AI agents build and maintain Vase UI. The tables show every token that they have used so far. The count includes the research, the plan, the experiments, the failed rounds and the discarded work. It does not count a person's time or CI minutes.

<!-- cost:start -->

Measured on 2026-11-12 (UTC).

| Model             |    Output | Cache writes | Cache reads |  All tokens |
| ----------------- | --------: | -----------: | ----------: | ----------: |
| Claude Sonnet 5.5 | 2,964,523 |   13,082,476 | 375,340,773 | 391,390,830 |
| Claude Fable 5.2  |   795,540 |    4,969,677 |  56,659,262 |  62,425,075 |
| Claude Opus 5.5   |   120,211 |      520,136 |  14,755,772 |  15,396,287 |
| Total             | 3,880,274 |   18,572,289 | 446,755,807 | 469,212,192 |

| Work              |  All tokens |
| ----------------- | ----------: |
| Experiments       | 273,271,075 |
| Pull requests     | 108,168,906 |
| Research and plan |  72,410,136 |
| Coordination      |  15,362,075 |

<!-- cost:end -->

"All tokens" also counts the uncached input, which has no column. Every measurement is in [cost/history.json](https://github.com/vase-ui/vase-ui/blob/main/cost/history.json). We update the count at each release.

## Thanks

Vase UI is a port, so the hard part was done before we started. The engineers behind Base UI, and behind Floating UI and aria-hidden before it, spent years on focus management, screen readers and browser bugs. We carried their work across. Every one of them is named in [THANKS.md](THANKS.md).

> This project is free and open-source work by a 501(c)(3) non-profit. If you find it useful, please consider [donating](https://github.com/sponsors/mathematic-inc).
