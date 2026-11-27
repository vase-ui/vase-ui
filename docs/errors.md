---
navigation: false
description: The text of each error code that a production build of Vase UI gives.
---

<script setup lang="ts">
import ErrorCodes from './.vitepress/components/ErrorCodes.vue';
</script>

# Errors

A production build of Vase UI has no error texts, so that the bundle is smaller. An error gives its code, its values and the address of its text on this page:

```text
Vase UI error #3 ["Image"]: https://vase-ui.com/errors#3
```

The values take the places of `{0}`, `{1}` and so on in the text, in order. A development build gives the full text.

<ErrorCodes />
