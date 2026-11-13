<script setup lang="ts">
import { shallowRef } from 'vue';
import { mergeProps } from '@vase-ui/vue/merge-props';

function a() {}
function b() {}
const refA = shallowRef<Element | null>(null);
const refB = shallowRef<Element | null>(null);

// #region rightmost
mergeProps<'div'>({ id: 'a', dir: 'ltr' }, { id: 'b' });
// #endregion rightmost

// #region ref
mergeProps<'div'>({ ref: refA }, { ref: refB });
// #endregion ref

// #region class
mergeProps<'div'>({ class: 'a' }, { class: 'b' });
// #endregion class

// #region handlers
mergeProps<'button'>({ onClick: a }, { onClick: b });
// #endregion handlers
</script>
