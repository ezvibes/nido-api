# ==============================================================================
# Nido API - Cloud Run v2 Declarative Service
# ==============================================================================
# Replaces imperative "gcloud run deploy" commands with declarative HCL.
# Enforces PCA enterprise standards:
# - Least privilege runtime IAM service account
# - Direct VPC Egress with PRIVATE_RANGES_ONLY
# - Managed Cloud SQL Proxy Unix Socket mount (/cloudsql)
# - Secret Manager value bindings (zero static credentials in code/env)
# ==============================================================================

resource "google_cloud_run_v2_service" "nido_api" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = var.runtime_service_account
    max_instance_request_concurrency = var.cloud_run_concurrency

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    # Direct VPC Egress (Issue #119 PCA Hardening)
    # Routes RFC 1918 internal database traffic over VPC while letting Gemini API exit to public internet
    vpc_access {
      network_interfaces {
        network    = var.vpc_network
        subnetwork = var.vpc_subnet
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      # Standard application environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "DB_HOST"
        value = "/cloudsql/${var.sql_instance_connection}"
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_USER"
        value = var.db_user
      }

      env {
        name  = "DB_NAME"
        value = var.db_name
      }

      # Secret Manager Bindings (Zero static secrets in code)
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = "nido-db-password"
            version = "latest"
          }
        }
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "nido-gemini-api-key"
            version = "latest"
          }
        }
      }

      # Mount Cloud SQL Proxy Unix Socket
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
}

# Allow unauthenticated public ingress to the API endpoint (Cloud Run Invoker)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.nido_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
