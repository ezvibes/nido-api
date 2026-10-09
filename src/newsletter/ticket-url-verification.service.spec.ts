import { TicketUrlVerificationService } from './ticket-url-verification.service';

type PinnedDestination = Parameters<
  TicketUrlVerificationService['performPinnedRequest']
>[0];

class TestTicketUrlVerificationService extends TicketUrlVerificationService {
  readonly request = jest.fn();
  readonly resolve = jest.fn();

  protected override resolveAddresses(hostname: string) {
    return this.resolve(hostname);
  }

  protected override performPinnedRequest(
    destination: PinnedDestination,
    method: 'HEAD' | 'GET',
  ) {
    return this.request(destination, method);
  }
}

describe('TicketUrlVerificationService', () => {
  let service: TestTicketUrlVerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestTicketUrlVerificationService();
  });

  it('enforces the batch limit at the NestJS service boundary', async () => {
    await expect(service.verifyUrls([])).rejects.toThrow(
      'Ticket URL verification requires between 1 and 10 URLs.',
    );
    expect(service.request).not.toHaveBeenCalled();
  });

  it('classifies a successful public URL as reachable', async () => {
    service.request.mockResolvedValue({ status: 200 });

    await expect(
      service.verifyUrls(['https://93.184.216.34/tickets']),
    ).resolves.toEqual([
      {
        url: 'https://93.184.216.34/tickets',
        status: 'reachable',
        statusCode: 200,
        method: 'HEAD',
      },
    ]);
  });

  it('blocks private destinations before issuing a request', async () => {
    await expect(
      service.verifyUrls(['http://169.254.169.254/computeMetadata/v1/']),
    ).resolves.toEqual([
      expect.objectContaining({
        status: 'blocked',
        reason: 'Local and private network destinations are not allowed.',
      }),
    ]);
    expect(service.request).not.toHaveBeenCalled();
  });

  it('blocks bracketed private IPv6 destinations before issuing a request', async () => {
    await expect(
      service.verifyUrls(['http://[::1]/internal']),
    ).resolves.toEqual([expect.objectContaining({ status: 'blocked' })]);
    expect(service.request).not.toHaveBeenCalled();
  });

  it('revalidates redirects and blocks a redirect to a private destination', async () => {
    service.request.mockResolvedValue({
      status: 302,
      location: 'http://127.0.0.1/internal',
    });

    await expect(
      service.verifyUrls(['https://93.184.216.34/tickets']),
    ).resolves.toEqual([
      expect.objectContaining({
        finalUrl: 'http://127.0.0.1/internal',
        status: 'blocked',
      }),
    ]);
    expect(service.request).toHaveBeenCalledTimes(1);
  });

  it('falls back to a range-limited GET when HEAD is unsupported', async () => {
    service.request
      .mockResolvedValueOnce({ status: 405 })
      .mockResolvedValueOnce({ status: 200 });

    await expect(
      service.verifyUrls(['https://93.184.216.34/tickets']),
    ).resolves.toEqual([
      expect.objectContaining({ status: 'reachable', method: 'GET' }),
    ]);
    expect(service.request.mock.calls[1][0].url.toString()).toBe(
      'https://93.184.216.34/tickets',
    );
    expect(service.request.mock.calls[1][1]).toBe('GET');
  });

  it('returns indeterminate when the network request fails', async () => {
    service.request.mockRejectedValue(new Error('socket unavailable'));

    await expect(
      service.verifyUrls(['https://93.184.216.34/tickets']),
    ).resolves.toEqual([
      {
        url: 'https://93.184.216.34/tickets',
        status: 'indeterminate',
        reason: 'URL could not be verified.',
      },
    ]);
  });

  it('pins the validated DNS answer into the network request', async () => {
    service.resolve
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
    service.request.mockResolvedValue({ status: 200 });

    await expect(
      service.verifyUrls(['https://tickets.example.com/show']),
    ).resolves.toEqual([
      expect.objectContaining({ status: 'reachable', statusCode: 200 }),
    ]);

    expect(service.resolve).toHaveBeenCalledTimes(1);
    expect(service.request).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '93.184.216.34',
        family: 4,
      }),
      'HEAD',
    );
  });
});
