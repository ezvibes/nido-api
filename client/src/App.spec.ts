import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

const authUser = vi.hoisted(() => ({
  value: { email: 'member@example.com', displayName: 'Member' } as {
    email: string;
    displayName: string;
  } | null,
}));

vi.mock('./composables/useAuth', async () => {
  const { ref } = await import('vue');
  const user = ref(authUser.value);
  return {
    useAuth: () => {
      user.value = authUser.value;
      return {
        user,
        signOut: vi.fn(),
      };
    },
  };
});

enableAutoUnmount(afterEach);

describe('App navigation', () => {
  it('hides Sync Doctor and admin tools from non-admin venue partners in the account menu', async () => {
    authUser.value = { email: 'member@example.com', displayName: 'Member' };
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
    expect(wrapper.find('.header-menu > a[href="/my-submissions"]').exists()).toBe(false);

    await wrapper.get('.account-menu__button').trigger('click');
    await flushPromises();

    expect(wrapper.find('.account-menu__dropdown a[href="/concert-sync"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('.account-menu__dropdown a[href="/my-submissions"]').text()).toBe(
      'My Poster Submissions',
    );
  });

  it('shows Sync Doctor and clarified admin review labels for admin users', async () => {
    authUser.value = { email: 'ezvibesinc@gmail.com', displayName: 'Admin' };
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

    await wrapper.get('.account-menu__button').trigger('click');
    await flushPromises();

    expect(wrapper.get('.account-menu__dropdown a[href="/concert-sync"]').text()).toBe(
      'Sync Doctor',
    );
    expect(wrapper.get('.account-menu__dropdown a[href="/admin/concerts"]').text()).toBe(
      'Admin Concerts',
    );
    expect(
      wrapper.get('.account-menu__dropdown a[href="/admin/ingestion/uploads"]').text(),
    ).toBe('Poster Review (OCR)');
  });
});
