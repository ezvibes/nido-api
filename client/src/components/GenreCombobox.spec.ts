import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import GenreCombobox from './GenreCombobox.vue';

enableAutoUnmount(afterEach);

describe('GenreCombobox', () => {
  it('filters case-insensitively and emits the canonical selected option', async () => {
    const wrapper = mount(GenreCombobox, {
      props: {
        modelValue: '',
        options: ['Electronic', 'Jazz'],
      },
    });
    const input = wrapper.get<HTMLInputElement>('[role="combobox"]');

    await input.trigger('focus');
    await input.setValue('ELECT');

    expect(wrapper.findAll('[role="option"]').map((option) => option.text())).toEqual([
      'Electronic',
    ]);

    await wrapper.get('[role="option"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toContainEqual(['Electronic']);
    expect(input.element.value).toBe('Electronic');
  });

  it('renders no more than the configured number of matches', async () => {
    const wrapper = mount(GenreCombobox, {
      props: {
        modelValue: '',
        options: Array.from({ length: 40 }, (_, index) => `Genre ${index + 1}`),
        maxVisibleOptions: 25,
      },
    });

    await wrapper.get('[role="combobox"]').trigger('focus');

    expect(wrapper.findAll('[role="option"]')).toHaveLength(25);
  });

  it('supports Arrow Up and Down with Enter selection', async () => {
    const wrapper = mount(GenreCombobox, {
      props: {
        modelValue: '',
        options: ['Ambient', 'Blues', 'Country'],
      },
    });
    const input = wrapper.get('[role="combobox"]');

    await input.trigger('focus');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('update:modelValue')).toContainEqual(['Blues']);

    await input.trigger('focus');
    await input.setValue('');
    await input.trigger('keydown', { key: 'ArrowUp' });
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('update:modelValue')).toContainEqual(['Country']);
  });

  it('closes on Escape and clears without selecting a fallback', async () => {
    const wrapper = mount(GenreCombobox, {
      props: {
        modelValue: 'Jazz',
        options: ['Jazz', 'Other'],
      },
    });
    const input = wrapper.get<HTMLInputElement>('[role="combobox"]');

    await input.trigger('focus');
    expect(input.attributes('aria-expanded')).toBe('true');

    await input.trigger('keydown', { key: 'Escape' });
    expect(input.attributes('aria-expanded')).toBe('false');

    await wrapper.get('button[aria-label="Clear genre"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toContainEqual(['']);
    expect(input.element.value).toBe('');
    expect(wrapper.emitted('update:modelValue')).not.toContainEqual(['Other']);
  });

  it('does not submit arbitrary text in controlled selection mode', async () => {
    const wrapper = mount(GenreCombobox, {
      props: {
        modelValue: '',
        options: ['Electronic', 'Other'],
        allowCustom: false,
      },
    });
    const input = wrapper.get('[role="combobox"]');

    await input.setValue('My invented genre');
    await input.trigger('keydown', { key: 'Enter' });

    const updates = wrapper.emitted('update:modelValue') ?? [];
    expect(updates.every(([value]) => value === '')).toBe(true);
    expect(wrapper.get('[role="listbox"]').find('[role="status"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[role="status"]').text()).toBe('No matching genres.');
  });

  it('accepts custom text only when custom-entry mode is enabled', async () => {
    const wrapper = mount(GenreCombobox, {
      props: {
        modelValue: '',
        options: ['Electronic'],
        allowCustom: true,
      },
    });
    const input = wrapper.get('[role="combobox"]');

    await input.setValue('  New Wave  ');
    await input.trigger('blur');

    expect(wrapper.emitted('update:modelValue')).toContainEqual(['New Wave']);
    expect((input.element as HTMLInputElement).value).toBe('New Wave');
  });
});
