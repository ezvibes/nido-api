import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

vi.mock('./composables/useAuth', async () => {
  const { ref } = await import('vue');
  return {
    useAuth: () => ({
      user: ref({ email: 'member@example.com', displayName: 'Member' }),
      signOut: vi.fn(),
    }),
  };
});

enableAutoUnmount(afterEach);

describe('App navigation', () => {
  it('shows Sync Doctor in the account menu, not the primary navigation', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
          RouterView: true,
        },
      },
    });

    expect(wrapper.find('.header-menu > a[href="/concert-sync"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/concert-sync"]').exists()).toBe(false);

    await wrapper.get('.account-menu__button').trigger('click');

    expect(wrapper.get('.account-menu__dropdown a[href="/concert-sync"]').text()).toBe(
      'Sync Doctor',
    );
  });
});
