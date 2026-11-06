import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTerraformPlan } from './validate-terraform-plan.mjs';

const oldImage = `repo/nido-api@sha256:${'a'.repeat(64)}`;
const newImage = `repo/nido-api@sha256:${'b'.repeat(64)}`;
const service = (image, ingress = 'INGRESS_TRAFFIC_ALL', extraEnv = []) => ({
  ingress,
  template: [
    {
      containers: [
        {
          image,
          env: [{ name: 'DB_MIGRATIONS_RUN', value: 'false' }, ...extraEnv],
        },
      ],
    },
  ],
});
const plan = (before, after, actions = ['update']) => ({
  resource_changes: [
    {
      address: 'google_cloud_run_v2_service.nido_api',
      change: { actions, before, after },
    },
  ],
});

test('accepts the built digest as the only service change or a no-op', () => {
  assert.doesNotThrow(() =>
    validateTerraformPlan(plan(service(oldImage), service(newImage)), newImage),
  );
  assert.doesNotThrow(() =>
    validateTerraformPlan(
      plan(service(newImage), service(newImage), ['no-op']),
      newImage,
    ),
  );
  assert.doesNotThrow(() => {
    const multiPlan = {
      resource_changes: [
        {
          address: 'google_cloud_run_v2_service.nido_api',
          change: {
            actions: ['update'],
            before: service(oldImage),
            after: service(newImage),
          },
        },
        {
          address: 'google_cloud_run_v2_service.nido_worker[0]',
          change: {
            actions: ['update'],
            before: service(oldImage),
            after: service(newImage),
          },
        },
      ],
    };
    validateTerraformPlan(multiPlan, newImage);
  });
  assert.doesNotThrow(() => {
    const before = service(oldImage);
    const after = {
      ...service(newImage),
      labels: { app: 'nido', environment: 'dev' },
      effective_labels: { app: 'nido', environment: 'dev' },
      terraform_labels: { app: 'nido' },
    };
    validateTerraformPlan(plan(before, after), newImage);
  });
  assert.doesNotThrow(() => {
    const vpcAccess = [
      {
        egress: 'PRIVATE_RANGES_ONLY',
        network_interfaces: [{ network: 'default', subnetwork: 'default' }],
      },
    ];
    const before = {
      ...service(oldImage),
      template: [{ ...service(oldImage).template[0], vpc_access: vpcAccess }],
    };
    const after = {
      ...service(newImage),
      template: [{ ...service(newImage).template[0], vpc_access: vpcAccess }],
    };
    validateTerraformPlan(plan(before, after), newImage);
  });
});

test('accepts initial provisioning of worker pipeline resources alongside API service image update and worker env vars', () => {
  const workerEnv = [
    { name: 'INGESTION_ASYNC_DISPATCH_ENABLED', value: 'true' },
    {
      name: 'CLOUD_TASKS_QUEUE_PATH',
      value: 'projects/p/locations/l/queues/q',
    },
    { name: 'INGESTION_WORKER_URL', value: 'https://worker' },
    { name: 'INGESTION_WORKER_AUDIENCE', value: 'https://worker' },
    { name: 'CLOUD_TASKS_INVOKER_SA', value: 'sa@p.iam.gserviceaccount.com' },
  ];

  const initialBootstrapPlan = {
    resource_changes: [
      {
        address: 'google_cloud_run_v2_service.nido_api',
        change: {
          actions: ['update'],
          before: service(oldImage),
          after: service(newImage, 'INGRESS_TRAFFIC_ALL', workerEnv),
        },
      },
      {
        address: 'google_project_service.cloudtasks[0]',
        change: { actions: ['create'] },
      },
      {
        address: 'google_cloud_tasks_queue.ingestion_worker[0]',
        change: { actions: ['create'] },
      },
      {
        address: 'google_cloud_tasks_queue_iam_member.api_enqueuer[0]',
        change: { actions: ['create'] },
      },
      {
        address: 'google_cloud_run_v2_service.nido_worker[0]',
        change: {
          actions: ['create'],
          before: null,
          after: service(newImage, 'INGRESS_TRAFFIC_ALL', workerEnv),
        },
      },
      {
        address: 'google_cloud_run_v2_service_iam_member.worker_invoker[0]',
        change: { actions: ['create'] },
      },
    ],
  };

  assert.doesNotThrow(() =>
    validateTerraformPlan(initialBootstrapPlan, newImage),
  );
});

test('rejects configuration drift, unexpected resources, and unauthorized env vars', () => {
  assert.throws(() =>
    validateTerraformPlan(
      plan(
        service(oldImage),
        service(newImage, 'INGRESS_TRAFFIC_INTERNAL_ONLY'),
      ),
      newImage,
    ),
  );
  assert.throws(() =>
    validateTerraformPlan(plan(service(oldImage), service(oldImage)), newImage),
  );
  assert.throws(() =>
    validateTerraformPlan(
      plan(service(oldImage), service(newImage), ['delete', 'create']),
      newImage,
    ),
  );
  assert.throws(() => {
    const before = service(oldImage);
    const after = service(newImage, 'INGRESS_TRAFFIC_ALL', [
      { name: 'UNAUTHORIZED_CUSTOM_VAR', value: 'attack' },
    ]);
    validateTerraformPlan(plan(before, after), newImage);
  }, /Plan changes API service Cloud Run settings besides the release image/);
  assert.throws(() => {
    const before = service(oldImage);
    const after = {
      ...service(newImage),
      template: [
        {
          ...service(newImage).template[0],
          vpc_access: [
            {
              egress: 'PRIVATE_RANGES_ONLY',
              network_interfaces: [
                { network: 'default', subnetwork: 'default' },
              ],
            },
          ],
        },
      ],
    };
    validateTerraformPlan(plan(before, after), newImage);
  });
  assert.throws(
    () => validateTerraformPlan({ resource_changes: [] }, newImage),
    /Plan must contain between 1 and 6 allowed resources/,
  );
  assert.throws(
    () =>
      validateTerraformPlan(
        {
          resource_changes: [
            {
              address: 'google_cloud_tasks_queue.ingestion_worker[0]',
              change: { actions: ['create'] },
            },
          ],
        },
        newImage,
      ),
    /Plan must include the nido_api service/,
  );
  assert.throws(
    () =>
      validateTerraformPlan(
        {
          resource_changes: [
            ...plan(service(oldImage), service(newImage)).resource_changes,
            {
              address: 'google_storage_bucket.state',
              change: { actions: ['create'] },
            },
          ],
        },
        newImage,
      ),
    /Plan contains an unauthorized resource: google_storage_bucket.state/,
  );
  assert.throws(
    () =>
      validateTerraformPlan(
        {
          resource_changes: [
            ...plan(service(oldImage), service(newImage)).resource_changes,
            {
              address: 'google_cloud_tasks_queue.ingestion_worker[0]',
              change: { actions: ['delete'] },
            },
          ],
        },
        newImage,
      ),
    /Plan must not delete resources/,
  );
  assert.throws(
    () =>
      validateTerraformPlan(
        {
          resource_changes: [
            ...plan(service(oldImage), service(newImage)).resource_changes,
            {
              address: 'google_cloud_run_v2_service.nido_worker[0]',
              change: {
                actions: ['create'],
                after: service(oldImage), // wrong digest
              },
            },
          ],
        },
        newImage,
      ),
    /Planned worker service image differs from the built digest/,
  );
});
