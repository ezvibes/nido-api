variable "project_id" {
  type        = string
  description = "Google Cloud project hosting the API service."
}

variable "region" {
  type        = string
  description = "Cloud Run service region."
}

variable "service_name" {
  type        = string
  description = "Existing Cloud Run API service name."
}

variable "container_image" {
  type        = string
  description = "Immutable image reference built by the release workflow."
}

variable "runtime_service_account" {
  type        = string
  description = "Service account used by the API container."
}

variable "sql_instance_connection" {
  type        = string
  description = "Cloud SQL project:region:instance connection name."
}

variable "cloud_run_memory" {
  type        = string
  description = "Memory limit per Cloud Run instance."
}

variable "cloud_run_cpu" {
  type        = string
  description = "CPU limit per Cloud Run instance."
}

variable "cloud_run_concurrency" {
  type        = number
  description = "Maximum concurrent requests per instance."
}

variable "cloud_run_timeout" {
  type        = number
  description = "Request timeout in seconds."
}

variable "cloud_run_min_instances" {
  type        = number
  description = "Minimum instances for the API service."
}

variable "cloud_run_max_instances" {
  type        = number
  description = "Maximum instances for the API service."
}

variable "runtime_env" {
  type        = map(string)
  description = "Non-secret API environment variables."
}

variable "secret_refs" {
  type = map(object({
    secret  = string
    version = string
  }))
  description = "Secret Manager references; never secret values."
}
