import { defineComponent, h, inject, provide, type InjectionKey } from 'vue';

export const textKey: InjectionKey<() => string> = Symbol('text');

// Vapor mode compiles only an SFC, so these two components stay virtual DOM components in each
// setup.

export const VdomProvider = defineComponent({
  props: { text: { type: String, required: true } },
  setup(props, { slots }) {
    provide(textKey, () => props.text);
    return () => slots.default?.();
  },
});

export const VdomInjector = defineComponent({
  setup() {
    const text = inject(textKey, () => 'none');
    return () => h('span', text());
  },
});
