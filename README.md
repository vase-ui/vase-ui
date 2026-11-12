# Vase UI

<!-- #region home -->

Base UI, arranged for Vue.

Vase UI is a port of [Base UI](https://base-ui.com) to Vue 3: the same unstyled, accessible components, with the same parts, data attributes and CSS variables, written as Vue components. It ships no styles. A vase should not pick your flowers.

Vase UI is an independent project. It is not affiliated with MUI.

## Our guarantee

Every Base UI component and documented API has a Vase UI counterpart.

- When Base UI publishes a release, the matching Vase UI release follows within 14 days. A Base UI major release arrives under the `next` tag in that time, and becomes `latest` in our next January release.
- [The parity page](https://vase-ui.github.io/vase-ui/parity) shows, for every component, the Base UI commit it matches, and every Base UI change with its state: mirrored, queued, or not applicable to Vue, with the reason.
- Where Vue or the browser lets us handle an edge case better than the original, we do, and we list each one with its test.

<!-- status:start -->

Status: 5 of 38 components. The guarantee starts with the first full release.

<!-- status:end -->

## Why

React gets the good component libraries first. Vue gets to wait. We think the Vue ecosystem deserves the same love as React's, so we stopped waiting.

## What this costs

AI agents build and maintain Vase UI. The tables show every token that they have used so far. The count includes the research, the plan, the experiments, the failed rounds and the discarded work. It does not count a person's time or CI minutes.

<!-- cost:start -->

Measured on 2026-11-12 (UTC). Prices read on 2026-11-12.

| Model             |     Output | Cache writes |   Cache reads |    All tokens | API price |
| ----------------- | ---------: | -----------: | ------------: | ------------: | --------: |
| Claude Sonnet 5.5 |  9,510,330 |   35,152,704 | 1,236,697,352 | 1,281,371,490 |   $306.68 |
| Claude Fable 5.2  |  5,781,360 |   38,318,178 |   646,803,073 |   690,908,899 |   $815.76 |
| Claude Opus 5.5   |    266,660 |    1,706,016 |    28,403,048 |    30,376,258 |    $19.55 |
| Total             | 15,558,350 |   75,176,898 | 1,911,903,473 | 2,002,656,647 | $1,141.99 |

| Work              |    All tokens | API price |
| ----------------- | ------------: | --------: |
| Pull requests     | 1,455,994,335 |   $769.72 |
| Experiments       |   315,968,417 |    $98.19 |
| Coordination      |   135,200,221 |   $230.11 |
| Research and plan |    72,410,136 |    $37.08 |
| Other             |    23,083,538 |     $6.88 |

<!-- cost:end -->

"All tokens" also counts the uncached input, which has no column. "API price" is what these tokens cost in US dollars at the API's [list prices](https://platform.claude.com/docs/en/about-claude/pricing) on the date that the prices were read. Cache writes are priced by their lifetime, 5 minutes or 1 hour. For a few messages the API reports more cache writes than the sum of the two lifetimes, and we price that rest as 5-minute writes. Each price is rounded to the cent, so the prices in a table do not always add up to the total.

Every measurement is in [cost/history.json](https://github.com/vase-ui/vase-ui/blob/main/cost/history.json). We update the count at each release and at the end of each stage of the port.

<!-- #endregion home -->

## Thanks

Vase UI is a port, so the hard part was done before we started. The engineers behind Base UI, and behind Floating UI and aria-hidden before it, spent years on focus management, screen readers and browser bugs. We carried their work across. Every one of them is named in [THANKS.md](THANKS.md).

## Contributing

Start with a [Discussion](https://github.com/vase-ui/vase-ui/discussions/new) instead of opening a pull request. If we accept the proposal, a Mathematic maintainer or agent will implement it. When we implement your proposal, the pull request will link to the Discussion and credit you as the proposal's original author. GitHub restricts pull request creation to Mathematic maintainers and repository collaborators with write, maintain, or admin access, plus authorized maintenance agents. See [CONTRIBUTING.md](https://github.com/vase-ui/vase-ui/blob/main/CONTRIBUTING.md) for the full process.

Do not report a security problem in a Discussion. Use [GitHub's private vulnerability reporting](https://github.com/vase-ui/vase-ui/security/advisories/new).

<!-- #region donation -->

> This project is free and open-source work by a 501(c)(3) non-profit. If you find it useful, please consider [donating](https://github.com/sponsors/mathematic-inc).

<!-- #endregion donation -->
