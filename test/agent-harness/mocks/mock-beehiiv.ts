export const MOCK_BEEHIIV_ENDPOINT =
  'https://api.beehiiv.com/v2/publications/fixture-publication/posts';

export interface CapturedDraft {
  title: string;
  status: 'draft';
  blocks: Array<{ type: 'html'; html: string }>;
}

export function createMockBeehiivTransport() {
  const drafts: CapturedDraft[] = [];
  const fetchMock = jest.fn(
    (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url !== MOCK_BEEHIIV_ENDPOINT || init?.method !== 'POST') {
        throw new Error(
          'Unexpected external request in offline newsletter harness.',
        );
      }
      if (typeof init.body !== 'string')
        throw new Error('Expected a JSON string payload.');
      const payload = JSON.parse(init.body) as CapturedDraft;
      if (
        payload.status !== 'draft' ||
        typeof payload.title !== 'string' ||
        !Array.isArray(payload.blocks) ||
        payload.blocks.length !== 1 ||
        payload.blocks[0].type !== 'html' ||
        typeof payload.blocks[0].html !== 'string'
      ) {
        throw new Error(
          'Only an HTML draft may be staged in the offline transport.',
        );
      }
      drafts.push(payload);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              id: `fixture-draft-${drafts.length}`,
              title: payload.title,
              status: 'draft',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    },
  );
  return { drafts, fetchMock };
}
