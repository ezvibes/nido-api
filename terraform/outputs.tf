output "service_name" {
  description = "The deployed Cloud Run service name"
  value       = google_cloud_run_v2_service.nido_api.name
}

output "service_uri" {
  description = "The live HTTPS URL of the Cloud Run API"
  value       = google_cloud_run_v2_service.nido_api.uri
}

output "latest_created_revision" {
  description = "The latest revision name created by Terraform"
  value       = google_cloud_run_v2_service.nido_api.latest_created_revision
}

output "worker_service_name" {
  description = "The deployed Cloud Run worker service name"
  value       = var.enable_worker_pipeline ? google_cloud_run_v2_service.nido_worker[0].name : null
}

output "worker_service_uri" {
  description = "The private HTTPS URL of the Cloud Run worker"
  value       = var.enable_worker_pipeline ? google_cloud_run_v2_service.nido_worker[0].uri : null
}

output "cloud_tasks_queue_name" {
  description = "The Cloud Tasks queue name"
  value       = var.enable_worker_pipeline ? google_cloud_tasks_queue.ingestion_worker[0].name : null
}
