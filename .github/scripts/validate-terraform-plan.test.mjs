import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTerraformPlan } from './validate-terraform-plan.mjs';

const oldImage = `repo/nido-api@sha256:${'a'.repeat(64)}`;
const newImage = `repo/nido-api@sha256:${'b'.repeat(64)}`;
const service = (image, ingress = 'INGRESS_TRAFFIC_ALL') => ({
  ingress,
  template: [{ containers: [{ image, env: [{ name: 'DB_MIGRATIONS_RUN', value: 'false' }] }] }],
});
const plan = (before, after, actions = ['update']) => ({
  resource_changes: [{
    address: 'google_cloud_run_v2_service.nido_api',
    change: { actions, before, after },
  }],
});

test('accepts the built digest as the only service change or a no-op', () => {
  assert.doesNotThrow(() => validateTerraformPlan(plan(service(oldImage), service(newImage)), newImage));
  assert.doesNotThrow(() => validateTerraformPlan(plan(service(newImage), service(newImage), ['no-op']), newImage));
});

test('rejects configuration drift, unexpected resources, and other plans', () => {
  assert.throws(() => validateTerraformPlan(plan(service(oldImage), service(newImage, 'INGRESS_TRAFFIC_INTERNAL_ONLY')), newImage));
  assert.throws(() => validateTerraformPlan(plan(service(oldImage), service(oldImage)), newImage));
  assert.throws(() => validateTerraformPlan(plan(service(oldImage), service(newImage), ['delete', 'create']), newImage));
  assert.throws(() => validateTerraformPlan({ resource_changes: [] }, newImage));
  assert.throws(() => validateTerraformPlan({ resource_changes: [
    ...plan(service(oldImage), service(newImage)).resource_changes,
    { address: 'google_storage_bucket.state', change: { actions: ['create'] } },
  ] }, newImage));
});
