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

variable "enable_worker_pipeline" {
  type        = bool
  description = "Controls whether the Cloud Tasks queue and private worker service are provisioned."
  default     = true
}

variable "worker_service_name" {
  type        = string
  description = "Private Cloud Run worker service name for OCR ingestion."
  default     = "nido-ingestion-worker"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.worker_service_name))
    error_message = "The worker_service_name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "worker_runtime_service_account" {
  type        = string
  description = "Service account used by the worker Cloud Run container."
  default     = "nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com"

  validation {
    condition     = can(regex("^[a-z0-9-]+@[a-z0-9-]+\\.iam\\.gserviceaccount\\.com$", var.worker_runtime_service_account))
    error_message = "The worker_runtime_service_account must be a valid GCP service account email address."
  }
}

variable "worker_memory" {
  type        = string
  description = "Memory limit per worker instance."
  default     = "1Gi"

  validation {
    condition     = can(regex("^[0-9]+(Mi|Gi)$", var.worker_memory))
    error_message = "The worker_memory must be specified in Mi or Gi (e.g., 512Mi, 1Gi, 2Gi)."
  }
}

variable "worker_cpu" {
  type        = string
  description = "CPU limit per worker instance."
  default     = "1"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?$", var.worker_cpu))
    error_message = "The worker_cpu must be a valid CPU count (e.g., 1, 2, 0.5)."
  }
}

variable "worker_concurrency" {
  type        = number
  description = "Maximum concurrent requests per worker instance."
  default     = 2

  validation {
    condition     = var.worker_concurrency >= 1 && var.worker_concurrency <= 10
    error_message = "The worker_concurrency must be between 1 and 10."
  }
}

variable "worker_timeout" {
  type        = number
  description = "Worker request timeout in seconds."
  default     = 600

  validation {
    condition     = var.worker_timeout >= 1 && var.worker_timeout <= 1800
    error_message = "The worker_timeout must be between 1 and 1800 seconds."
  }
}

variable "worker_min_instances" {
  type        = number
  description = "Minimum instances for the worker service (must be 0 for scale-to-zero)."
  default     = 0

  validation {
    condition     = var.worker_min_instances >= 0
    error_message = "The worker_min_instances must be greater than or equal to 0."
  }
}

variable "worker_max_instances" {
  type        = number
  description = "Maximum instances for the worker service."
  default     = 2

  validation {
    condition     = var.worker_max_instances >= 1 && var.worker_max_instances <= 10
    error_message = "The worker_max_instances must be between 1 and 10."
  }
}

variable "cloud_tasks_queue_name" {
  type        = string
  description = "Cloud Tasks queue name for ingestion OCR tasks."
  default     = "ingestion-worker-queue"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.cloud_tasks_queue_name))
    error_message = "The cloud_tasks_queue_name must contain only letters, numbers, and hyphens."
  }
}

variable "cloud_tasks_queue_location" {
  type        = string
  description = "Cloud Tasks queue location region."
  default     = "us-east1"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.cloud_tasks_queue_location))
    error_message = "The cloud_tasks_queue_location must be a valid GCP region."
  }
}

variable "cloud_tasks_dispatch_rate" {
  type        = number
  description = "Maximum dispatch rate (dispatches per second) for Cloud Tasks queue."
  default     = 1

  validation {
    condition     = var.cloud_tasks_dispatch_rate >= 0.1 && var.cloud_tasks_dispatch_rate <= 100
    error_message = "The cloud_tasks_dispatch_rate must be between 0.1 and 100 per second."
  }
}

variable "cloud_tasks_max_concurrency" {
  type        = number
  description = "Maximum concurrent dispatches for Cloud Tasks queue."
  default     = 2

  validation {
    condition     = var.cloud_tasks_max_concurrency >= 1 && var.cloud_tasks_max_concurrency <= 50
    error_message = "The cloud_tasks_max_concurrency must be between 1 and 50."
  }
}

variable "cloud_tasks_max_attempts" {
  type        = number
  description = "Maximum retry attempts per task in Cloud Tasks queue."
  default     = 5

  validation {
    condition     = var.cloud_tasks_max_attempts >= 1 && var.cloud_tasks_max_attempts <= 25
    error_message = "The cloud_tasks_max_attempts must be between 1 and 25."
  }
}

variable "cloud_tasks_min_backoff" {
  type        = string
  description = "Minimum retry backoff duration for Cloud Tasks queue (e.g. 1s)."
  default     = "1s"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?s$", var.cloud_tasks_min_backoff))
    error_message = "The cloud_tasks_min_backoff must be specified in seconds (e.g. 1s, 0.1s)."
  }
}

variable "cloud_tasks_max_backoff" {
  type        = string
  description = "Maximum retry backoff duration for Cloud Tasks queue (e.g. 300s)."
  default     = "300s"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?s$", var.cloud_tasks_max_backoff))
    error_message = "The cloud_tasks_max_backoff must be specified in seconds (e.g. 300s)."
  }
}

variable "cloud_tasks_max_retry_duration" {
  type        = string
  description = "Maximum retry duration for failed Cloud Tasks (e.g. 3600s)."
  default     = "3600s"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?s$", var.cloud_tasks_max_retry_duration))
    error_message = "The cloud_tasks_max_retry_duration must be specified in seconds (e.g. 3600s)."
  }
}

variable "cloud_tasks_max_doublings" {
  type        = number
  description = "Number of times retry backoff doubles."
  default     = 5

  validation {
    condition     = var.cloud_tasks_max_doublings >= 0 && var.cloud_tasks_max_doublings <= 16
    error_message = "The cloud_tasks_max_doublings must be between 0 and 16."
  }
}

variable "cloud_tasks_invoker_sa" {
  type        = string
  description = "Service account used by Cloud Tasks to invoke the worker via OIDC."
  default     = "cloud-tasks-invoker@nido-api-9ed65.iam.gserviceaccount.com"

  validation {
    condition     = can(regex("^[a-z0-9-]+@[a-z0-9-]+\\.iam\\.gserviceaccount\\.com$", var.cloud_tasks_invoker_sa))
    error_message = "The cloud_tasks_invoker_sa must be a valid GCP service account email address."
  }
}
