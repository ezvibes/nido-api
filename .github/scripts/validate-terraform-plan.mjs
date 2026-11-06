import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const allowedServiceAddresses = new Set([
  'google_cloud_run_v2_service.nido_api',
  'google_cloud_run_v2_service.nido_worker',
  'google_cloud_run_v2_service.nido_worker[0]',
]);

const allowedInfrastructureAddresses = new Set([
  'google_project_service.cloudtasks',
  'google_project_service.cloudtasks[0]',
  'google_cloud_tasks_queue.ingestion_worker',
  'google_cloud_tasks_queue.ingestion_worker[0]',
  'google_cloud_tasks_queue_iam_member.api_enqueuer',
  'google_cloud_tasks_queue_iam_member.api_enqueuer[0]',
  'google_cloud_run_v2_service_iam_member.worker_invoker',
  'google_cloud_run_v2_service_iam_member.worker_invoker[0]',
]);

const approvedWorkerEnvVars = new Set([
  'INGESTION_ASYNC_DISPATCH_ENABLED',
  'CLOUD_TASKS_QUEUE_PATH',
  'INGESTION_WORKER_URL',
  'INGESTION_WORKER_AUDIENCE',
  'CLOUD_TASKS_INVOKER_SA',
]);

const imageOf = (service) => service?.template?.[0]?.containers?.[0]?.image;

const withoutReleaseImage = (service) => {
  const copy = structuredClone(service);
  if (copy?.template?.[0]?.containers?.[0]) {
    delete copy.template[0].containers[0].image;
    if (Array.isArray(copy.template[0].containers[0].env)) {
      copy.template[0].containers[0].env = copy.template[0].containers[0].env.filter(
        (e) => !approvedWorkerEnvVars.has(e?.name),
      );
    }
  }
  delete copy.labels;
  delete copy.effective_labels;
  delete copy.terraform_labels;
  return copy;
};

export function validateTerraformPlan(plan, expectedImage) {
  const changes = plan?.resource_changes;
  assert(
    Array.isArray(changes) && changes.length >= 1 && changes.length <= 6,
    'Plan must contain between 1 and 6 allowed resources',
  );

  const hasApiService = changes.some(
    (c) => c.address === 'google_cloud_run_v2_service.nido_api',
  );
  assert(hasApiService, 'Plan must include the nido_api service');

  for (const { address, change } of changes) {
    assert(
      !change?.actions?.includes('delete'),
      `Plan must not delete resources: ${address}`,
    );

    if (allowedServiceAddresses.has(address)) {
      if (address === 'google_cloud_run_v2_service.nido_api') {
        assert(
          isDeepStrictEqual(change?.actions, ['no-op']) ||
            isDeepStrictEqual(change?.actions, ['update']),
          'API service plan must be a no-op or an image-only update',
        );
        assert.equal(
          imageOf(change.after),
          expectedImage,
          'Planned API service image differs from the built digest',
        );
        if (isDeepStrictEqual(change.actions, ['update'])) {
          assert(
            imageOf(change.before),
            'Prior API service image is missing from the plan',
          );
          assert(
            isDeepStrictEqual(
              withoutReleaseImage(change.before),
              withoutReleaseImage(change.after),
            ),
            'Plan changes API service Cloud Run settings besides the release image',
          );
        }
      } else {
        // Worker service (nido_worker or nido_worker[0])
        assert(
          isDeepStrictEqual(change?.actions, ['no-op']) ||
            isDeepStrictEqual(change?.actions, ['update']) ||
            isDeepStrictEqual(change?.actions, ['create']),
          'Worker service plan must be a create, no-op, or update',
        );
        assert.equal(
          imageOf(change.after),
          expectedImage,
          'Planned worker service image differs from the built digest',
        );
        if (isDeepStrictEqual(change.actions, ['update'])) {
          assert(
            imageOf(change.before),
            'Prior worker service image is missing from the plan',
          );
          assert(
            isDeepStrictEqual(
              withoutReleaseImage(change.before),
              withoutReleaseImage(change.after),
            ),
            'Plan changes worker service Cloud Run settings besides the release image',
          );
        }
      }
    } else if (allowedInfrastructureAddresses.has(address)) {
      assert(
        isDeepStrictEqual(change?.actions, ['create']) ||
          isDeepStrictEqual(change?.actions, ['no-op']) ||
          isDeepStrictEqual(change?.actions, ['update']),
        `Infrastructure plan for ${address} must be create, no-op, or update`,
      );
    } else {
      assert.fail(`Plan contains an unauthorized resource: ${address}`);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const expectedImage = process.argv[2];
  if (!expectedImage) throw new Error('Expected the built image digest');

  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  validateTerraformPlan(JSON.parse(input), expectedImage);
}
