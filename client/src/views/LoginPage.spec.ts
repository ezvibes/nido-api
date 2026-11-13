import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LoginPage from './LoginPage.vue';

const signInWithGoogle = vi.fn();
const signUpWithEmail = vi.fn();
const signInWithEmail = vi.fn();
const devLogin = vi.fn();

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    devLogin,
  }),
}));

describe('LoginPage', () => {
  it('renders Continue with Google as the primary CTA with partner welcome copy', () => {
    const wrapper = mount(LoginPage);

    expect(wrapper.text()).toContain('Venue Partners');
    expect(wrapper.text()).toContain('Talent Buyers');
    const googleButton = wrapper.find('.btn-google--hero');
    expect(googleButton.exists()).toBe(true);
    expect(googleButton.text()).toContain('Continue with Google');
  });

  it('calls signInWithGoogle when clicking Continue with Google', async () => {
    signInWithGoogle.mockClear();
    const wrapper = mount(LoginPage);

    await wrapper.find('.btn-google--hero').trigger('click');
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});
