<script setup lang="ts">
import { h, ref, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import styles from './index.module.css';

const mainPermissions = ['view-dashboard', 'manage-users', 'access-reports'];
const userManagementPermissions = ['create-user', 'edit-user', 'delete-user', 'assign-roles'];

const id = useId();
const mainValue = ref<string[]>([]);
const managementValue = ref<string[]>([]);

function changeMainValue(value: string[]) {
  if (value.includes('manage-users')) {
    managementValue.value = userManagementPermissions;
  } else if (managementValue.value.length === userManagementPermissions.length) {
    managementValue.value = [];
  }
  mainValue.value = value;
}

function changeManagementValue(value: string[]) {
  if (value.length === userManagementPermissions.length) {
    mainValue.value = Array.from(new Set([...mainValue.value, 'manage-users']));
  } else {
    mainValue.value = mainValue.value.filter((item) => item !== 'manage-users');
  }
  managementValue.value = value;
}

const CheckIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );

const HorizontalRuleIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '12',
      height: '12',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'stroke-width': 1,
      style: { display: 'block' },
    },
    [
      h('line', {
        x1: '3',
        y1: '12',
        x2: '21',
        y2: '12',
        stroke: 'currentColor',
        'vector-effect': 'non-scaling-stroke',
      }),
    ],
  );
</script>

<template>
  <CheckboxGroup
    :aria-labelledby="id"
    :model-value="mainValue"
    :all-values="mainPermissions"
    :class="styles.CheckboxGroup"
    :style="{ marginLeft: '1rem' }"
    @value-change="changeMainValue"
  >
    <label :class="styles.Item" :id="id" :style="{ marginLeft: '-1rem' }">
      <Checkbox
        parent
        :indeterminate="
          managementValue.length > 0 && managementValue.length !== userManagementPermissions.length
        "
      >
        <template #element="{ props, elementRef, state }">
          <span :class="styles.Box">
            <input v-bind="props" :ref="elementRef" :class="styles.Checkbox" />
            <span :class="styles.Indicator">
              <HorizontalRuleIcon v-if="state.indeterminate" />
              <CheckIcon v-else />
            </span>
          </span>
        </template>
      </Checkbox>
      User Permissions
    </label>

    <label :class="styles.Item">
      <span :class="styles.Box">
        <Checkbox value="view-dashboard" :class="styles.Checkbox" />
        <span :class="styles.Indicator"><CheckIcon /></span>
      </span>
      View Dashboard
    </label>

    <label :class="styles.Item">
      <span :class="styles.Box">
        <Checkbox value="access-reports" :class="styles.Checkbox" />
        <span :class="styles.Indicator"><CheckIcon /></span>
      </span>
      Access Reports
    </label>

    <CheckboxGroup
      aria-labelledby="manage-users-caption"
      :class="styles.CheckboxGroup"
      :model-value="managementValue"
      :all-values="userManagementPermissions"
      :style="{ marginLeft: '1rem' }"
      @value-change="changeManagementValue"
    >
      <label :class="styles.Item" id="manage-users-caption" :style="{ marginLeft: '-1rem' }">
        <Checkbox parent>
          <template #element="{ props, elementRef, state }">
            <span :class="styles.Box">
              <input v-bind="props" :ref="elementRef" :class="styles.Checkbox" />
              <span :class="styles.Indicator">
                <HorizontalRuleIcon v-if="state.indeterminate" />
                <CheckIcon v-else />
              </span>
            </span>
          </template>
        </Checkbox>
        Manage Users
      </label>

      <label :class="styles.Item">
        <span :class="styles.Box">
          <Checkbox value="create-user" :class="styles.Checkbox" />
          <span :class="styles.Indicator"><CheckIcon /></span>
        </span>
        Create User
      </label>

      <label :class="styles.Item">
        <span :class="styles.Box">
          <Checkbox value="edit-user" :class="styles.Checkbox" />
          <span :class="styles.Indicator"><CheckIcon /></span>
        </span>
        Edit User
      </label>

      <label :class="styles.Item">
        <span :class="styles.Box">
          <Checkbox value="delete-user" :class="styles.Checkbox" />
          <span :class="styles.Indicator"><CheckIcon /></span>
        </span>
        Delete User
      </label>

      <label :class="styles.Item">
        <span :class="styles.Box">
          <Checkbox value="assign-roles" :class="styles.Checkbox" />
          <span :class="styles.Indicator"><CheckIcon /></span>
        </span>
        Assign Roles
      </label>
    </CheckboxGroup>
  </CheckboxGroup>
</template>
