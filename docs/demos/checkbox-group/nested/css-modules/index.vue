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
    :value="mainValue"
    :all-values="mainPermissions"
    :class="styles.CheckboxGroup"
    :style="{ marginLeft: '1rem' }"
    @value-change="changeMainValue"
  >
    <label :class="styles.Item" :id="id" :style="{ marginLeft: '-1rem' }">
      <Checkbox.Root
        :class="styles.Checkbox"
        parent
        :indeterminate="
          managementValue.length > 0 && managementValue.length !== userManagementPermissions.length
        "
      >
        <Checkbox.Indicator :class="styles.Indicator">
          <template #render="{ props, state }">
            <span v-bind="props">
              <HorizontalRuleIcon v-if="state.indeterminate" />
              <CheckIcon v-else />
            </span>
          </template>
        </Checkbox.Indicator>
      </Checkbox.Root>
      User Permissions
    </label>

    <label :class="styles.Item">
      <Checkbox.Root value="view-dashboard" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      View Dashboard
    </label>

    <label :class="styles.Item">
      <Checkbox.Root value="access-reports" :class="styles.Checkbox">
        <Checkbox.Indicator :class="styles.Indicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Access Reports
    </label>

    <CheckboxGroup
      aria-labelledby="manage-users-caption"
      :class="styles.CheckboxGroup"
      :value="managementValue"
      :all-values="userManagementPermissions"
      :style="{ marginLeft: '1rem' }"
      @value-change="changeManagementValue"
    >
      <label :class="styles.Item" id="manage-users-caption" :style="{ marginLeft: '-1rem' }">
        <Checkbox.Root :class="styles.Checkbox" parent>
          <Checkbox.Indicator :class="styles.Indicator">
            <template #render="{ props, state }">
              <span v-bind="props">
                <HorizontalRuleIcon v-if="state.indeterminate" />
                <CheckIcon v-else />
              </span>
            </template>
          </Checkbox.Indicator>
        </Checkbox.Root>
        Manage Users
      </label>

      <label :class="styles.Item">
        <Checkbox.Root value="create-user" :class="styles.Checkbox">
          <Checkbox.Indicator :class="styles.Indicator">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Create User
      </label>

      <label :class="styles.Item">
        <Checkbox.Root value="edit-user" :class="styles.Checkbox">
          <Checkbox.Indicator :class="styles.Indicator">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Edit User
      </label>

      <label :class="styles.Item">
        <Checkbox.Root value="delete-user" :class="styles.Checkbox">
          <Checkbox.Indicator :class="styles.Indicator">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Delete User
      </label>

      <label :class="styles.Item">
        <Checkbox.Root value="assign-roles" :class="styles.Checkbox">
          <Checkbox.Indicator :class="styles.Indicator">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Assign Roles
      </label>
    </CheckboxGroup>
  </CheckboxGroup>
</template>
