<script setup vapor lang="ts">
import { provide, type PropType } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterLink,
  routeLocationKey,
  routerKey,
} from 'vue-router';
import VaporTargetWithElement from './VaporTargetWithElement.vue';

defineProps({
  is: { type: String as PropType<'h2' | 'router-link' | 'vapor'>, required: true },
  // A Vapor app calls a root prop that is a function, so the function is in an object.
  probe: {
    type: Object as PropType<{ record(value: unknown): void }>,
    default: () => ({ record() {} }),
  },
});

// `RouterLink` reads the router from these keys. `app.use(router)` gives them in an app.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { render: () => null } }],
});
provide(routerKey, router);
provide(routeLocationKey, router.currentRoute.value);

const components = { h2: 'h2', 'router-link': RouterLink, vapor: VaporTargetWithElement };
</script>

<template>
  <component
    :is="components[is]"
    :ref="probe.record"
    v-bind="is === 'router-link' ? { to: '/' } : {}"
    data-probe=""
    >Text</component
  >
</template>
