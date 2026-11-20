---
order: 2
description: The principles behind Vase UI.
---

# Methodology

We build Vase UI around six principles:

- **Robust foundations.** We build on Base UI’s engineering and the years of experience behind its design decisions. Carrying that work forward gives Vase a strong foundation for reliable components.
- **Idiomatic Vue.** Base UI is built for React; Vase is built for Vue. We adapt its ideas to Vue’s compiler and reactivity model, keeping our components simple and using abstractions where they make sense for Vue.
- **Measurement before abstraction.** We let the browser do what it already does well. Before adding an abstraction, we measure native behavior to understand where it meets our needs and where it falls short. Our measurement tests track that behavior across browsers, so we know when a browser change lets us remove a workaround—or requires us to introduce one.
- **API evolution over legacy constraints.** We prioritize correctness and usability over preserving past decisions indefinitely. AI-assisted migrations can reduce the cost of change, strengthening the case for improving APIs instead of carrying their limitations forward. We evolve Vase’s API with that goal in mind, embracing Vue’s capabilities, including Vapor.
- **Testing is non-negotiable.** We use Vase in enterprise applications, where incorrect behavior can have real financial consequences. Our tests verify the contracts our components expose. Those contracts may evolve, but developers must be able to depend on the behavior we promise.
- **Consistency across browsers.** We care about the experience of users on every major browser. We test our components across those browsers and use pragmatic abstractions to address differences that affect their behavior. Cross-browser support is a commitment we verify continuously.
