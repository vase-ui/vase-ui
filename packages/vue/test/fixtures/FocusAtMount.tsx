import { defineComponent, onMounted, shallowRef } from 'vue';

// A browser does not apply `autofocus` to each input that Vue inserts.
export const FocusAtMount = defineComponent({
  setup() {
    const input = shallowRef<HTMLInputElement | null>(null);
    onMounted(() => input.value?.focus());
    return () => <input ref={input} />;
  },
});
