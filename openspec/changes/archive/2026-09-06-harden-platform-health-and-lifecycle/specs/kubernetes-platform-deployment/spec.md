## MODIFIED Requirements

### Requirement: Persistent Storage and Workload Deployment
The platform SHALL provide storage and database configuration supporting both local SQLite and PostgreSQL backends, deploying a `PersistentVolumeClaim` (1Gi, `ReadWriteOnce`) mounted at `/app/data` when using SQLite, supporting PostgreSQL connection strings and credentials via ConfigMaps and Secrets, supporting single-replica `Recreate` deployment for SQLite and multi-replica horizontal scalability for PostgreSQL, exposing deep database readiness probes (`/api/health/ready` and `/api/health`) and liveness probes (`/api/health/live`), handling graceful termination with asynchronous connection cleanup, and providing cluster `Service` and `Ingress` routing.

#### Scenario: SQLite data persistence across pod restarts
- **WHEN** the platform pod restarts or is rescheduled while configured for SQLite storage
- **THEN** the SQLite database mounted on the persistent volume retains all onboarded teams and configuration

#### Scenario: PostgreSQL database credential injection
- **WHEN** the platform pod is deployed with PostgreSQL configuration
- **THEN** environment variables `DATABASE_CLIENT` and `DATABASE_URL` (or `POSTGRES_*` host, port, database, user, password) are injected from Kubernetes ConfigMaps and Secrets into the container environment

#### Scenario: Horizontal pod scaling with PostgreSQL backend
- **WHEN** the platform deployment is configured with PostgreSQL and `replicas > 1`
- **THEN** multiple pods run concurrently and handle API traffic without database lock contention

#### Scenario: Liveness and readiness health monitoring
- **WHEN** the Kubernetes kubelet probes the running container
- **THEN** `GET /api/health/live` returns HTTP 200 with status ok confirming process liveness, while `GET /api/health` and `GET /api/health/ready` verify database connectivity and return HTTP 200 when healthy or HTTP 503 when the database backend is unreachable

#### Scenario: Graceful lifecycle teardown on termination signals
- **WHEN** the platform process receives `SIGTERM` or `SIGINT` termination signals
- **THEN** the server stops accepting new connections, awaits asynchronous database connection draining, and exits cleanly within the configured grace period

#### Scenario: Cluster service and ingress routing
- **WHEN** external traffic reaches the platform domain
- **THEN** the Ingress and Service route HTTP traffic to container port 3000
