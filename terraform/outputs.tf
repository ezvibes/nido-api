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
