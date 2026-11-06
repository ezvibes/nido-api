# The existing service must be imported and its first plan reviewed before this
# resource becomes the dev deploy path. The migration job remains owned by gcloud.
resource "google_cloud_run_v2_service" "nido_api" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true

  scaling {
    min_instance_count = 0
  }

  template {
    service_account                  = var.runtime_service_account
    max_instance_request_concurrency = var.cloud_run_concurrency
    timeout                          = "${var.cloud_run_timeout}s"

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    dynamic "vpc_access" {
      for_each = var.vpc_network != null && var.vpc_subnet != null ? [1] : []
      content {
        egress = var.vpc_egress
        network_interfaces {
          network    = var.vpc_network
          subnetwork = var.vpc_subnet
        }
      }
    }

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = var.runtime_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_refs
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      startup_probe {
        failure_threshold = 1
        period_seconds    = 240
        timeout_seconds   = 240
        tcp_socket {
          port = 8080
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.sql_instance_connection]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = var.labels

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [client, client_version, labels["client"], labels["client-version"]]
  }
}

# Enable Cloud Tasks API for asynchronous worker dispatch
resource "google_project_service" "cloudtasks" {
  count              = var.enable_worker_pipeline ? 1 : 0
  project            = var.project_id
  service            = "cloudtasks.googleapis.com"
  disable_on_destroy = false
}

# Environment-specific Cloud Tasks queue for OCR extraction tasks
resource "google_cloud_tasks_queue" "ingestion_worker" {
  count    = var.enable_worker_pipeline ? 1 : 0
  project  = var.project_id
  name     = var.cloud_tasks_queue_name
  location = var.cloud_tasks_queue_location

  rate_limits {
    max_dispatches_per_second = var.cloud_tasks_dispatch_rate
    max_concurrent_dispatches = var.cloud_tasks_max_concurrency
  }

  retry_config {
    max_attempts       = var.cloud_tasks_max_attempts
    min_backoff        = var.cloud_tasks_min_backoff
    max_backoff        = var.cloud_tasks_max_backoff
    max_retry_duration = var.cloud_tasks_max_retry_duration
    max_doublings      = var.cloud_tasks_max_doublings
  }

  depends_on = [google_project_service.cloudtasks]
}

# IAM Boundary: API runtime service account can only enqueue tasks to the queue
resource "google_cloud_tasks_queue_iam_member" "api_enqueuer" {
  count    = var.enable_worker_pipeline ? 1 : 0
  project  = var.project_id
  location = var.cloud_tasks_queue_location
  name     = google_cloud_tasks_queue.ingestion_worker[0].name
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${var.runtime_service_account}"
}

# Private scale-to-zero Cloud Run worker for asynchronous OCR extraction
resource "google_cloud_run_v2_service" "nido_worker" {
  count               = var.enable_worker_pipeline ? 1 : 0
  project             = var.project_id
  name                = var.worker_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  scaling {
    min_instance_count = 0
  }

  template {
    service_account                  = var.worker_runtime_service_account
    max_instance_request_concurrency = var.worker_concurrency
    timeout                          = "${var.worker_timeout}s"

    scaling {
      min_instance_count = var.worker_min_instances
      max_instance_count = var.worker_max_instances
    }

    dynamic "vpc_access" {
      for_each = var.vpc_network != null && var.vpc_subnet != null ? [1] : []
      content {
        egress = var.vpc_egress
        network_interfaces {
          network    = var.vpc_network
          subnetwork = var.vpc_subnet
        }
      }
    }

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.worker_cpu
          memory = var.worker_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = var.runtime_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_refs
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      startup_probe {
        failure_threshold = 1
        period_seconds    = 240
        timeout_seconds   = 240
        tcp_socket {
          port = 8080
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.sql_instance_connection]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = merge(var.labels, { component = "worker" })

  lifecycle {
    ignore_changes = [client, client_version, labels["client"], labels["client-version"]]
  }
}

# IAM Boundary: Task caller service account can invoke the private worker service
resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  count    = var.enable_worker_pipeline ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.nido_worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.cloud_tasks_invoker_sa}"
}
