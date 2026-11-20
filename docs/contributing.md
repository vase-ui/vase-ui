---
order: 5
description: Report bugs, request features and ask questions about Vase UI.
---

# Contributing

A clear report with a reproduction is the best way to help Vase UI. Mathematic writes all of the code with AI agents. GitHub lets only collaborators open a pull request.

## Report a bug

Open a discussion in [Bugs](https://github.com/vase-ui/vase-ui/discussions/new?category=bugs).

- Give the versions of `@vase-ui/vue` and Vue.
- Name the browser and the operating system, with their versions.
- Name the component or the site page.
- Give each step that shows the bug.
- Say what you expect and what happens.
- Include a reproduction link if you can, such as a StackBlitz project or a repository.

Vase UI is a port of Base UI. If Base UI has the same bug, you can also report it to [Base UI](https://github.com/mui/base-ui).

## Request a feature or ask a question

Request a change or a new feature in [Ideas](https://github.com/vase-ui/vase-ui/discussions/new?category=ideas). Ask a question in [Q&A](https://github.com/vase-ui/vase-ui/discussions/new?category=q-a).

## What happens next

An AI agent reads each new discussion in Bugs and Ideas.

1. For a bug, it writes a test that reproduces the fault and fails.
2. It makes the fix in a pull request that links to the discussion.
3. We review the pull request before it merges.

The agent answers in the discussion from the maintainer's account. Each reply includes this line:

> An AI agent wrote this reply.

The reply says when the fix reaches users. We publish package fixes in releases of `@vase-ui/vue`. We publish site fixes when we deploy the site.

## Report a security problem

Do not report a security problem in public. Use [GitHub's private vulnerability reporting](https://github.com/vase-ui/vase-ui/security/advisories/new). See our [security policy](https://github.com/vase-ui/vase-ui/blob/main/SECURITY.md) for the details to include.
