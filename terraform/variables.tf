variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID (e.g. nido-api-9ed65)"
}

variable "region" {
  type        = string
  description = "Google Cloud region for resources"
  default     = "us-east1"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name"
  default     = "nido-api"
}

variable "container_image" {
  type        = string
  description = "Artifact Registry container image URI"
}

variable "runtime_service_account" {
  type        = string
  description = "IAM Service Account email used by Cloud Run container at runtime"
}

variable "sql_instance_connection" {
  type        = string
  description = "Cloud SQL instance connection name (PROJECT_ID:REGION:INSTANCE_NAME)"
}

variable "db_user" {
  type        = string
  description = "PostgreSQL application user"
  default     = "nido_api"
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name"
  default     = "nido"
}

variable "cloud_run_memory" {
  type        = string
  description = "Memory limit for Cloud Run instance"
  default     = "512Mi"
}

variable "cloud_run_cpu" {
  type        = string
  description = "CPU allocation for Cloud Run instance"
  default     = "1"
}

variable "cloud_run_concurrency" {
  type        = number
  description = "Max concurrent requests per container instance"
  default     = 80
}

variable "cloud_run_min_instances" {
  type        = number
  description = "Minimum container instances (0 for serverless scale-to-zero)"
  default     = 0
}

variable "cloud_run_max_instances" {
  type        = number
  description = "Maximum container instances under peak load"
  default     = 20
}

variable "vpc_network" {
  type        = string
  description = "VPC network for Direct VPC Egress"
  default     = "default"
}

variable "vpc_subnet" {
  type        = string
  description = "VPC subnet for Direct VPC Egress"
  default     = "default"
}
