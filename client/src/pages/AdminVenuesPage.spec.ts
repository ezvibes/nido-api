import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminVenuesPage from './AdminVenuesPage.vue';
import type { VenueListItem } from '../composables/useApi';

const api = vi.hoisted(() => ({
  fetchVenues: vi.fn(),
  createVenue: vi.fn(),
  updateVenue: vi.fn(),
  deleteVenue: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: undefined as
    | { value: null | { getIdToken: () => Promise<string> } }
    | undefined,
}));

vi.mock('../composables/useAuth', async () => {
  const { ref } = await import('vue');
  auth.user = ref(null);
  return { useAuth: () => ({ user: auth.user }) };
});

vi.mock('../composables/useApi', () => api);

enableAutoUnmount(afterEach);

describe('AdminVenuesPage', () => {
  const mockVenues: VenueListItem[] = [
    {
      id: 'venue-1',
      name: "Cat's Cradle",
      address: '300 E Main St',
      postalCode: '27510',
      city: 'Carrboro',
      citySlug: 'carrboro',
      region: 'North Carolina',
      regionSlug: 'nc',
      capacity: 750,
      verificationState: 'canonical',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'venue-2',
      name: 'The Pour House',
      address: '224 S Blount St',
      postalCode: '27601',
      city: 'Raleigh',
      citySlug: 'raleigh',
      region: 'North Carolina',
      regionSlug: 'nc',
      capacity: 289,
      verificationState: 'verified',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'venue-3',
      name: 'The Evening Muse',
      address: '3227 N Davidson St',
      postalCode: '28205',
      city: 'Charlotte',
      citySlug: 'charlotte',
      region: 'North Carolina',
      regionSlug: 'nc',
      capacity: 120,
      verificationState: 'unverified',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'venue-4',
      name: 'Suspicious Basement',
      address: 'Unknown',
      postalCode: null,
      city: 'Wilmington',
      citySlug: 'wilmington',
      region: 'North Carolina',
      regionSlug: 'nc',
      capacity: null,
      verificationState: 'flagged',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('admin-token'),
    };
    api.fetchVenues.mockResolvedValue([...mockVenues]);
  });

  it('renders venue list with verification badges and metrics ribbon', async () => {
    const wrapper = mount(AdminVenuesPage);
    await flushPromises();

    expect(api.fetchVenues).toHaveBeenCalledWith('admin-token');
    expect(wrapper.text()).toContain("Cat's Cradle");
    expect(wrapper.text()).toContain('The Pour House');
    expect(wrapper.text()).toContain('The Evening Muse');
    expect(wrapper.text()).toContain('Suspicious Basement');

    // Verify Badges rendered
    expect(wrapper.find('[data-testid="badge-canonical"]').text()).toContain('Canonical');
    expect(wrapper.find('[data-testid="badge-verified"]').text()).toContain('Verified');
    expect(wrapper.find('[data-testid="badge-unverified"]').text()).toContain('Unverified');
    expect(wrapper.find('[data-testid="badge-flagged"]').text()).toContain('Flagged');

    // Check capacity and postal code display
    expect(wrapper.text()).toContain('👥 750');
    expect(wrapper.text()).toContain('📮 27510');
    expect(wrapper.text()).toContain('⚠️ Missing postal code');
  });

  it('filters venues by verification state filter', async () => {
    const wrapper = mount(AdminVenuesPage);
    await flushPromises();

    // Select 'unverified' filter
    const select = wrapper.get('[data-testid="venue-status-filter"]');
    await select.setValue('unverified');
    await flushPromises();

    expect(wrapper.text()).toContain('The Evening Muse');
    expect(wrapper.text()).not.toContain("Cat's Cradle");
    expect(wrapper.text()).not.toContain('The Pour House');
    expect(wrapper.text()).not.toContain('Suspicious Basement');
  });

  it('allows maintainers to promote an unverified venue to verified', async () => {
    api.updateVenue.mockResolvedValue({
      ...mockVenues[2],
      verificationState: 'verified',
    });

    const wrapper = mount(AdminVenuesPage);
    await flushPromises();

    const promoteBtn = wrapper.find('[data-testid="promote-verified-btn"]');
    expect(promoteBtn.exists()).toBe(true);
    await promoteBtn.trigger('click');
    await flushPromises();

    expect(api.updateVenue).toHaveBeenCalledWith('admin-token', 'venue-3', {
      verificationState: 'verified',
    });
    expect(wrapper.find('[data-testid="alert-success"]').text()).toContain(
      'Promoted venue "The Evening Muse" to verified',
    );
  });

  it('allows maintainers to promote a verified venue to canonical', async () => {
    api.updateVenue.mockResolvedValue({
      ...mockVenues[1],
      verificationState: 'canonical',
    });

    const wrapper = mount(AdminVenuesPage);
    await flushPromises();

    const canonicalBtn = wrapper.find('[data-testid="promote-canonical-btn"]');
    expect(canonicalBtn.exists()).toBe(true);
    await canonicalBtn.trigger('click');
    await flushPromises();

    expect(api.updateVenue).toHaveBeenCalledWith('admin-token', 'venue-2', {
      verificationState: 'canonical',
    });
    expect(wrapper.find('[data-testid="alert-success"]').text()).toContain(
      'Promoted venue "The Pour House" to canonical',
    );
  });

  it('allows flagging a venue for review', async () => {
    api.updateVenue.mockResolvedValue({
      ...mockVenues[0],
      verificationState: 'flagged',
    });

    const wrapper = mount(AdminVenuesPage);
    await flushPromises();

    const flagBtn = wrapper.find('[data-testid="flag-venue-btn"]');
    expect(flagBtn.exists()).toBe(true);
    await flagBtn.trigger('click');
    await flushPromises();

    expect(api.updateVenue).toHaveBeenCalledWith('admin-token', 'venue-1', {
      verificationState: 'flagged',
    });
  });

  it('creates a new venue with postal code, capacity, and verification state', async () => {
    const newVenuePayload: VenueListItem = {
      id: 'venue-new',
      name: 'The Orange Peel',
      address: '101 Biltmore Ave',
      postalCode: '28801',
      city: 'Asheville',
      citySlug: 'asheville',
      region: 'North Carolina',
      regionSlug: 'nc',
      capacity: 1050,
      verificationState: 'verified',
      createdAt: '2026-01-03T00:00:00Z',
      updatedAt: '2026-01-03T00:00:00Z',
    };
    api.createVenue.mockResolvedValue(newVenuePayload);

    const wrapper = mount(AdminVenuesPage);
    await flushPromises();

    const inputs = wrapper.findAll('.admin-venues__form input');
    await inputs[0]!.setValue('The Orange Peel');
    await inputs[1]!.setValue('101 Biltmore Ave');
    await inputs[2]!.setValue('28801');
    await inputs[3]!.setValue('Asheville');
    await inputs[4]!.setValue('asheville');
    await inputs[5]!.setValue('North Carolina');
    await inputs[6]!.setValue('nc');
    await inputs[7]!.setValue(1050);

    const select = wrapper.find('.admin-venues__form select');
    await select.setValue('verified');

    await wrapper.find('.admin-venues__form').trigger('submit');
    await flushPromises();

    expect(api.createVenue).toHaveBeenCalledWith(
      'admin-token',
      expect.objectContaining({
        name: 'The Orange Peel',
        address: '101 Biltmore Ave',
        postalCode: '28801',
        city: 'Asheville',
        citySlug: 'asheville',
        capacity: 1050,
        verificationState: 'verified',
      }),
    );
    expect(wrapper.find('[data-testid="alert-success"]').text()).toContain(
      'Successfully created venue "The Orange Peel"',
    );
  });
});
