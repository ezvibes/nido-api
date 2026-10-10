import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const serviceAddress = 'google_cloud_run_v2_service.nido_api';

const imageOf = (service) => service?.template?.[0]?.containers?.[0]?.image;

const withoutReleaseImage = (service) => {
  const copy = structuredClone(service);
  delete copy.template[0].containers[0].image;
  return copy;
};

export function validateTerraformPlan(plan, expectedImage) {
  const changes = plan?.resource_changes;
  assert(Array.isArray(changes) && changes.length === 1, 'Plan must contain exactly one service resource');

  const [{ address, change }] = changes;
  assert.equal(address, serviceAddress, 'Plan contains a resource outside the API service');
  assert(
    isDeepStrictEqual(change?.actions, ['no-op']) || isDeepStrictEqual(change?.actions, ['update']),
    'Plan must be a no-op or an image-only update',
  );
  assert.equal(imageOf(change.after), expectedImage, 'Planned image differs from the built digest');
  if (isDeepStrictEqual(change.actions, ['update'])) {
    assert(imageOf(change.before), 'Prior service image is missing from the plan');
    assert(
      isDeepStrictEqual(withoutReleaseImage(change.before), withoutReleaseImage(change.after)),
      'Plan changes Cloud Run settings besides the release image',
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const expectedImage = process.argv[2];
  if (!expectedImage) throw new Error('Expected the built image digest');

  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  validateTerraformPlan(JSON.parse(input), expectedImage);
}
