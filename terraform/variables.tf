variable "project_id" {
  type        = string
  description = "Google Cloud project hosting the API service."

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,29}$", var.project_id))
    error_message = "The project_id must be a valid GCP project ID (5-30 lower case characters, digits, or hyphens)."
  }
}

variable "region" {
  type        = string
  description = "Cloud Run service region."

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.region))
    error_message = "The region must be a valid GCP region name (e.g. us-east1, europe-west1)."
  }
}

variable "service_name" {
  type        = string
  description = "Existing Cloud Run API service name."

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.service_name))
    error_message = "The service_name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "container_image" {
  type        = string
  description = "Immutable image reference built by the release workflow."

  validation {
    condition     = can(regex("@sha256:[a-f0-9]{64}$", var.container_image))
    error_message = "The container_image must specify an immutable SHA-256 image digest (@sha256:...)."
  }
}

variable "runtime_service_account" {
  type        = string
  description = "Service account used by the API container."

  validation {
    condition     = can(regex("^[a-z0-9-]+@[a-z0-9-]+\\.iam\\.gserviceaccount\\.com$", var.runtime_service_account))
    error_message = "The runtime_service_account must be a valid GCP service account email address."
  }
}

variable "sql_instance_connection" {
  type        = string
  description = "Cloud SQL project:region:instance connection name."

  validation {
    condition     = can(regex("^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$", var.sql_instance_connection))
    error_message = "The sql_instance_connection must follow project:region:instance format."
  }
}

variable "cloud_run_memory" {
  type        = string
  description = "Memory limit per Cloud Run instance."

  validation {
    condition     = can(regex("^[0-9]+(Mi|Gi)$", var.cloud_run_memory))
    error_message = "The cloud_run_memory must be specified in Mi or Gi (e.g., 512Mi, 2Gi)."
  }
}

variable "cloud_run_cpu" {
  type        = string
  description = "CPU limit per Cloud Run instance."

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?$", var.cloud_run_cpu))
    error_message = "The cloud_run_cpu must be a valid CPU count (e.g., 1, 2, 0.5, 4)."
  }
}

variable "cloud_run_concurrency" {
  type        = number
  description = "Maximum concurrent requests per instance."

  validation {
    condition     = var.cloud_run_concurrency >= 1 && var.cloud_run_concurrency <= 1000
    error_message = "The cloud_run_concurrency must be between 1 and 1000."
  }
}

variable "cloud_run_timeout" {
  type        = number
  description = "Request timeout in seconds."

  validation {
    condition     = var.cloud_run_timeout >= 1 && var.cloud_run_timeout <= 3600
    error_message = "The cloud_run_timeout must be between 1 and 3600 seconds."
  }
}

variable "cloud_run_min_instances" {
  type        = number
  description = "Minimum instances for the API service."

  validation {
    condition     = var.cloud_run_min_instances >= 0
    error_message = "The cloud_run_min_instances must be greater than or equal to 0."
  }
}

variable "cloud_run_max_instances" {
  type        = number
  description = "Maximum instances for the API service."

  validation {
    condition     = var.cloud_run_max_instances >= 1
    error_message = "The cloud_run_max_instances must be greater than or equal to 1."
  }
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

variable "labels" {
  type        = map(string)
  description = "Labels to apply to created resources for cost allocation and operational tracking."
  default = {
    managed-by  = "terraform"
    component   = "api"
    app         = "nido"
    environment = "dev"
  }
}

variable "vpc_network" {
  type        = string
  description = "VPC network name or self_link for Cloud Run Direct VPC Egress (empty/null when disabled)."
  default     = null

  validation {
    condition     = var.vpc_network == null || can(regex("^[a-z][a-z0-9-]{0,62}$", var.vpc_network))
    error_message = "The vpc_network must be null or a valid GCP VPC network name."
  }
}

variable "vpc_subnet" {
  type        = string
  description = "VPC subnetwork name for Cloud Run Direct VPC Egress (empty/null when disabled)."
  default     = null

  validation {
    condition     = var.vpc_subnet == null || can(regex("^[a-z][a-z0-9-]{0,62}$", var.vpc_subnet))
    error_message = "The vpc_subnet must be null or a valid GCP VPC subnetwork name."
  }
}

variable "vpc_egress" {
  type        = string
  description = "VPC egress routing mode for Cloud Run Direct VPC Egress."
  default     = "PRIVATE_RANGES_ONLY"

  validation {
    condition     = var.vpc_egress == null || contains(["PRIVATE_RANGES_ONLY", "ALL_TRAFFIC"], var.vpc_egress)
    error_message = "The vpc_egress must be null, PRIVATE_RANGES_ONLY, or ALL_TRAFFIC."
  }
}
