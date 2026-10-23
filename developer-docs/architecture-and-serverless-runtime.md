# Cloud Architecture, Networking & Serverless Runtime

This document explains the cloud architecture, networking topology, and serverless runtime model powering the Nido API.

It serves as the conceptual reference for engineers and agents working on the platform, establishing a shared vocabulary around serverless compute, API routing boundaries, and private database networking.

---

## 1. The Architectural Mental Model: The Live Venue

To understand how Nido’s cloud infrastructure fits together, consider the metaphor of a modern concert venue:

```
                            [ Fans & Public Traffic ]
                                       │
                                       ▼ (HTTPS / Edge)
                         ┌───────────────────────────┐
                         │   THE FRONT GATE & FOYER  │  <- Google Cloud Run Edge
                         │ - Automatic TLS & Anycast │     (Managed Ingress & CDN)
                         │ - DDoS Shielding          │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │      THE BOX OFFICE       │  <- NestJS Application Layer
                         │ - FirebaseAuthGuard       │     (Software Gateway)
                         │ - Role / Admin Wristbands │
                         │ - DTO Bag Check           │
                         │ - Trace Context Tagging   │
                         └─────────────┬─────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
           ┌──────────────────────────┐  ┌──────────────────────────┐
           │     ON-DEMAND CREW       │  │    STAGE INTELLIGENCE    │
           │ Cloud Run Container Svc  │  │   Gemini 2.5/3.6/3.8     │
           │ (Scales up with crowd,   │  │   (Serverless LLM via    │
           │  scales to zero at night)│  │    Google ADK & Vertex)  │
           └────────────┬─────────────┘  └──────────────────────────┘
                        │
                        │ Direct VPC Egress (private-ranges-only)
                        │ =====================================
                        │  UNDERGROUND VIP TUNNEL (Private VPC)
                        │  (No public internet exposure)
                        │ =====================================
                        ▼
           ┌──────────────────────────┐
           │     THE BASEMENT VAULT   │  <- Cloud SQL (PostgreSQL)
           │ Dedicated Hardware & SSD │     (Managed Stateful Anchor)
           │ ACID Relational Catalog  │
           └──────────────────────────┘
```

* **The Front Gate & Foyer (Cloud Run Edge):** Manages all external ingress. It handles global traffic routing, TLS certificate renewal, and DDoS mitigation automatically.
* **The Box Office (NestJS Software Gateway):** Checks visitor credentials, inspects payloads for prohibited items (validation pipes), verifies admin VIP wristbands, and timestamps every entry with a trace ID.
* **The On-Demand Crew (Cloud Run Serverless Compute):** Staff arrives dynamically when doors open and goes home when the show ends. If nobody is visiting the site, the compute scales down to zero ($0 idle cost).
* **The Stage Intelligence (Google ADK + Gemini):** Multimodal AI called on-demand to read concert flyers, extract lineups, and summarize newsletters without provisioning dedicated GPU servers.
* **The Underground VIP Tunnel (Direct VPC Egress):** A dedicated, private subnetwork path connecting our serverless containers directly to our database without routing traffic over the public internet.
* **The Basement Vault (Cloud SQL):** The permanent, heavy-duty relational database sitting on a dedicated virtual machine with persistent SSD disks, guaranteeing ACID transaction safety.

---

## 2. Serverless vs. Managed State Anatomy

The Nido stack is approximately **85% to 90% serverless**. The division between stateless serverless compute and stateful managed persistence is intentional.

### The Serverless Footprint (~85–90%)

| Component | GCP Technology | Operating Characteristics |
| :--- | :--- | :--- |
| **API Service** | Cloud Run Service (`nido-api`) | **Scale-to-zero container runtime.** Containers spin up in milliseconds in response to HTTP traffic and spin down when idle. CPU is throttled during request lulls (`cpu_idle = true`), eliminating idle compute expenses. |
| **Schema Migrations** | Cloud Run Jobs (`nido-api-migrations`) | **Run-to-completion batch execution.** Used for TypeORM database migrations. Executes in an isolated container instance prior to service rollout, logs status, and exits. Zero persistent footprint. |
| **Asynchronous Work** | Google Cloud Tasks | **Serverless task dispatching.** Enqueues flyer ingestion and outbox payloads for decoupled background processing without maintaining dedicated Redis, Celery, or RabbitMQ worker nodes. |
| **Multimodal Intelligence** | Google ADK & Gemini API | **Token-based AI inference.** Vision, OCR, and event extraction are served via managed API calls (Gemini 2.5/3.6/3.8 Flash). Zero GPU maintenance. |
| **Media & Flyer Storage** | Google Cloud Storage (`gs://...`) | **Serverless blob storage.** High-durability object storage for flyer uploads, poster assets, and temporary export archives. Scales infinitely. |
| **Web Client Delivery** | Firebase Hosting CDN | **Serverless edge distribution.** Global CDN caching for the client single-page application, with automated SSL provisioning and instant rollbacks. |

### The Managed Stateful Anchor (Cloud SQL)

While compute and ingestion are fully serverless, the **relational catalog is not serverless**.

* **Why Cloud SQL PostgreSQL is a Managed PaaS Instance:**
  1. **Relational ACID Integrity:** Live music catalog data (venues, bands, co-bills, dates, ticket tiers) requires strict transactional integrity, foreign key cascading, and complex join queries that benefit from dedicated in-memory caches.
  2. **Predictable Query Latency:** Running on a dedicated Compute Engine instance in our local VPC (`us-east1`) provides consistent sub-5ms query response times, avoiding the cold-storage latency penalties common in early-generation serverless databases.
  3. **Isolated Private IP:** The database lives strictly inside our Google VPC on an RFC 1918 private IP address (`10.142.x.x`). Its public IP interface is locked down (`authorized_networks = []`).

---

## 3. The API Gateway Question: Why We Don't Have (or Need) a Standalone Gateway

Engineers frequently ask whether Nido employs a dedicated API Gateway (such as Google Cloud API Gateway, Apigee, Kong, or Envoy).

**Current Decision: We do not deploy a standalone API Gateway.**

### How Gateway Responsibilities Are Handled Today

Instead of adding another network hop and billing layer, gateway responsibilities are cleanly bifurcated:

```
[Client Request]
       │
       ▼
1. Outer Edge (Cloud Run Ingress)
   ├── Automatic Google-managed TLS termination
   ├── Global Anycast HTTP/2 & HTTP/3 routing
   ├── Cloud Run Revision Traffic Splitting (e.g. 90% v1, 10% v2)
   └── Infrastructure DDoS and layer-4 attack filtering
       │
       ▼
2. Inner Application Gateway (NestJS Architecture)
   ├── Global Route Prefixing (/api/v1)
   ├── Authentication Guard (FirebaseAuthGuard verifying Firebase JWTs)
   ├── Authorization Guard (AdminGuard enforcing catalog role permissions)
   ├── DTO Validation Pipes (class-validator enforcing strict payloads)
   ├── Trace Correlation (TraceContextMiddleware binding GCP traceparent headers)
   └── Structured Error Sanitization (Global Exception Filter)
```

### Why This Is Optimal for MVP & Beta
* **Lower Cold Starts & Latency:** Adding an external API Gateway inserts an additional TLS and HTTP proxy proxy hop before reaching Cloud Run.
* **Unified Developer Experience:** Authentication, authorization, and validation rules remain testable in TypeScript using standard Jest unit and HTTP contract tests.
* **Zero Infrastructure Overhead:** No separate API Gateway configuration files, OpenAPI sync pipelines, or standalone gateway runtime costs.

### When Would We Add a Dedicated API Gateway?
A standalone gateway (or Cloud Armor + External HTTP(S) Load Balancer) will be evaluated when:
1. **B2B API Monetization:** Third-party developer API keys, tier-based rate limiting, and consumption billing are required.
2. **Edge WAF Requirements:** OWASP Top 10 rule enforcement or IP geofencing at the edge via Google Cloud Armor.
3. **Multi-Service Microservice Routing:** If the monolith decomposes into multiple separate Cloud Run microservices requiring unified path-based edge routing.

---

## 4. Networking: The Underground VIP Tunnel (Direct VPC Egress)

One of the most critical security enhancements in Nido’s cloud deployment is **Direct VPC Egress**.

### The Problem With Public Database Endpoints
In naive cloud setups, serverless containers connect to managed databases across the public internet using authorized public IP allowlists. This introduces:
* Exposure of database port `5432` to the public internet.
* Risk of misconfigured firewall rules or credential sniffing.
* Variable network latency and egress egress egress bandwidth charges.

### How Direct VPC Egress Works in Nido

Cloud Run supports **Direct VPC Egress**, allowing containers to attach directly to a Google Cloud Virtual Private Cloud (VPC) network interface without needing a legacy Serverless VPC Access connector VM:

```
+-------------------------------------------------------------------------+
| Google Cloud Platform (Project: nido-api-9ed65, Region: us-east1)       |
|                                                                         |
|  +--------------------------------+                                     |
|  | Cloud Run Service (nido-api)   |                                     |
|  | Direct VPC Egress:             |                                     |
|  | - Network: default             |                                     |
|  | - Subnet: default              |                                     |
|  | - Egress: private-ranges-only  |                                     |
|  +----------------+---------------+                                     |
|                   |                                                     |
|                   | Private RFC 1918 Route (10.142.0.0/20)               |
|                   | (No traffic touches public internet)                |
|                   v                                                     |
|  +--------------------------------+                                     |
|  | Cloud SQL Postgres Instance    |                                     |
|  | Private IP: 10.142.x.x         |                                     |
|  | Public IP: Disabled / Blocked  |                                     |
|  +--------------------------------+                                     |
+-------------------------------------------------------------------------+
```

### Key Network Configuration Rules:
1. **`vpc-egress: private-ranges-only`:**
   * Traffic bound for private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) routes through the VPC directly into Cloud SQL.
   * Traffic bound for the public internet (external webhooks, Gemini API, Beehiiv, JamBase) exits through Google's default internet gateway directly.
2. **Zero Public Authorized Networks:**
   * Cloud SQL instance network configuration maintains an empty authorized network list, ensuring zero unauthorized external connections.
3. **Subnet Capacity:**
   * The `us-east1` default subnet (`10.142.0.0/20`) provides 4,094 private IPs, providing ample headroom for Cloud Run auto-scaling instance network interfaces.

---

## 5. Summary Cheat Sheet for Developers

* **When writing API endpoints:** Rely on NestJS Guards (`FirebaseAuthGuard`, `AdminGuard`) and DTO validation. Do not assume an external gateway will filter bad inputs.
* **When scheduling batch work:** Use Cloud Run Jobs or Cloud Tasks; never spin up an always-on background polling server.
* **When modifying database connections:** Always use private VPC routing parameters (`DB_HOST` pointed to the private IP or Cloud SQL instance connection name).
* **When writing Terraform:** Any infrastructure plan must pass `validate-terraform-plan.mjs`, ensuring zero unreviewed mutations to the production topology.
