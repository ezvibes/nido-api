<template>
  <div class="genre-combobox">
    <label class="genre-combobox__label" :for="resolvedInputId">
      {{ label }}
    </label>
    <div class="genre-combobox__input-wrap">
      <input
        :id="resolvedInputId"
        ref="inputElement"
        class="genre-combobox__input"
        type="text"
        role="combobox"
        autocomplete="off"
        :value="query"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-busy="loading || undefined"
        :aria-controls="listboxId"
        :aria-describedby="describedBy"
        :aria-expanded="isOpen"
        :aria-activedescendant="activeOptionId"
        aria-autocomplete="list"
        @focus="open"
        @input="handleInput"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <button
        v-if="query || modelValue"
        type="button"
        class="genre-combobox__clear"
        aria-label="Clear genre"
        :disabled="disabled"
        @mousedown.prevent
        @click="clearSelection"
      >
        ×
      </button>
    </div>

    <div
      v-if="isOpen"
      class="genre-combobox__popup"
    >
      <ul
        :id="listboxId"
        class="genre-combobox__listbox"
        role="listbox"
        :aria-label="`${label} options`"
      >
        <li
          v-for="(option, index) in visibleOptions"
          :id="optionId(index)"
          :key="option"
          class="genre-combobox__option"
          :class="{ 'genre-combobox__option--active': index === activeIndex }"
          role="option"
          :aria-selected="option === modelValue"
          @mousemove="activeIndex = index"
          @mousedown.prevent
          @click="selectOption(option)"
        >
          {{ option }}
        </li>
      </ul>
      <p
        v-if="!visibleOptions.length"
        class="genre-combobox__empty"
        role="status"
      >
        {{ loading ? 'Loading genres…' : 'No matching genres.' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: string[];
    label?: string;
    placeholder?: string;
    loading?: boolean;
    disabled?: boolean;
    allowCustom?: boolean;
    maxVisibleOptions?: number;
    inputId?: string;
    describedBy?: string;
  }>(),
  {
    label: 'Genre',
    placeholder: 'Select a genre',
    loading: false,
    disabled: false,
    allowCustom: false,
    maxVisibleOptions: 25,
    inputId: undefined,
    describedBy: undefined,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const generatedId = useId();
const inputElement = ref<HTMLInputElement | null>(null);
const query = ref(props.modelValue);
const isOpen = ref(false);
const isFocused = ref(false);
const activeIndex = ref(-1);

const normalize = (value: string) => value.trim().toLocaleLowerCase();
const resolvedInputId = computed(
  () => props.inputId || `genre-combobox-${generatedId}`,
);
const listboxId = computed(() => `${resolvedInputId.value}-listbox`);
const uniqueOptions = computed(() => {
  const seen = new Set<string>();
  return props.options.filter((option) => {
    const key = normalize(option);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
});
const visibleOptions = computed(() => {
  const needle = normalize(query.value);
  const matches = needle
    ? uniqueOptions.value.filter((option) => normalize(option).includes(needle))
    : uniqueOptions.value;
  return matches.slice(0, Math.max(0, props.maxVisibleOptions));
});
const activeOptionId = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < visibleOptions.value.length
    ? optionId(activeIndex.value)
    : undefined,
);

watch(
  () => props.modelValue,
  (value) => {
    if (!isFocused.value) {
      query.value = value;
    }
  },
);

watch(visibleOptions, (options) => {
  if (activeIndex.value >= options.length) {
    activeIndex.value = options.length ? options.length - 1 : -1;
  }
});

function optionId(index: number) {
  return `${listboxId.value}-option-${index}`;
}

function open() {
  if (props.disabled) {
    return;
  }
  isFocused.value = true;
  isOpen.value = true;
}

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  query.value = value;
  isOpen.value = true;
  activeIndex.value = -1;

  if (props.allowCustom) {
    emit('update:modelValue', value);
  } else if (normalize(value) !== normalize(props.modelValue)) {
    emit('update:modelValue', '');
  }
}

function handleBlur() {
  isFocused.value = false;
  isOpen.value = false;
  activeIndex.value = -1;

  if (props.allowCustom) {
    const customValue = query.value.trim();
    query.value = customValue;
    emit('update:modelValue', customValue);
  } else {
    query.value = props.modelValue;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    isOpen.value = true;
    if (visibleOptions.value.length) {
      activeIndex.value =
        activeIndex.value < visibleOptions.value.length - 1
          ? activeIndex.value + 1
          : 0;
    }
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    isOpen.value = true;
    if (visibleOptions.value.length) {
      activeIndex.value =
        activeIndex.value > 0
          ? activeIndex.value - 1
          : visibleOptions.value.length - 1;
    }
    return;
  }

  if (event.key === 'Enter') {
    if (isOpen.value && activeIndex.value >= 0) {
      event.preventDefault();
      const option = visibleOptions.value[activeIndex.value];
      if (option) {
        selectOption(option);
      }
    } else if (props.allowCustom) {
      event.preventDefault();
      const customValue = query.value.trim();
      query.value = customValue;
      emit('update:modelValue', customValue);
      isOpen.value = false;
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    isOpen.value = false;
    activeIndex.value = -1;
    if (!props.allowCustom) {
      query.value = props.modelValue;
    }
  }
}

function selectOption(option: string) {
  query.value = option;
  emit('update:modelValue', option);
  isOpen.value = false;
  activeIndex.value = -1;
}

function clearSelection() {
  query.value = '';
  emit('update:modelValue', '');
  activeIndex.value = -1;
  isOpen.value = true;
  void nextTick(() => inputElement.value?.focus());
}
</script>

<style scoped>
.genre-combobox {
  position: relative;
  display: grid;
  gap: 0.35rem;
  width: 100%;
  color: var(--text);
  text-align: left;
}

.genre-combobox__label {
  color: var(--text-muted, var(--text));
  font-size: 0.9rem;
  font-weight: 600;
}

.genre-combobox__input-wrap {
  position: relative;
}

.genre-combobox__input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 0.85rem;
  padding: 0.75rem 2.5rem 0.75rem 0.85rem;
  background: var(--surface, #fff);
  color: var(--text-dark, var(--text));
  font: inherit;
}

.genre-combobox__input:focus {
  border-color: var(--accent);
  outline: 2px solid color-mix(in srgb, var(--accent) 25%, transparent);
  outline-offset: 1px;
}

.genre-combobox__input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.genre-combobox__clear {
  position: absolute;
  top: 50%;
  right: 0.65rem;
  width: 1.7rem;
  height: 1.7rem;
  border: 0;
  border-radius: 999px;
  padding: 0;
  transform: translateY(-50%);
  background: transparent;
  color: var(--text-muted, #667085);
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
}

.genre-combobox__clear:hover {
  background: var(--surface-soft, #f2f4f7);
}

.genre-combobox__popup {
  position: absolute;
  z-index: 30;
  top: 100%;
  right: 0;
  left: 0;
  max-height: 18rem;
  overflow-y: auto;
  margin: 0.25rem 0 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 0.3rem;
  background: var(--surface, #fff);
  box-shadow: 0 12px 30px rgba(16, 24, 40, 0.16);
}

.genre-combobox__listbox {
  margin: 0;
  padding: 0;
  list-style: none;
}

.genre-combobox__option,
.genre-combobox__empty {
  border-radius: 0.55rem;
  padding: 0.6rem 0.7rem;
}

.genre-combobox__option {
  cursor: pointer;
}

.genre-combobox__option--active,
.genre-combobox__option:hover {
  background: var(--surface-soft, #f2f4f7);
  color: var(--accent);
}

.genre-combobox__empty {
  margin: 0;
  color: var(--text-muted, #667085);
  font-size: 0.9rem;
}
</style>
