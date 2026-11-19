import { reactive } from 'vue';

/** Attributes of an `Input` that write each `valueChange` and `update:modelValue` in `log`. */
export function recordEmits(log: string[], attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onValueChange: (value: string) => log.push(`valueChange ${value}`),
    'onUpdate:modelValue': (value: string) => log.push(`update ${value}`),
    ...attrs,
  });
}

/** The attributes of `v-model` on an `Input`, and the log of `recordEmits` when one is given. */
export function vModel(modelValue: unknown, log?: string[]) {
  const attrs: Record<string, unknown> = reactive({ modelValue });
  if (log) attrs.onValueChange = (value: string) => log.push(`valueChange ${value}`);
  attrs['onUpdate:modelValue'] = (value: string) => {
    log?.push(`update ${value}`);
    attrs.modelValue = value;
  };
  return attrs;
}

export function emitsFor(...values: string[]) {
  return values.flatMap((value) => [`valueChange ${value}`, `update ${value}`]);
}
