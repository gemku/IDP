## MODIFIED Requirements

### Requirement: Real-Time Resource Utilization Gauges
The platform backend SHALL query pod metrics from the Kubernetes Metrics API (`metrics.k8s.io/v1beta1`) and calculate percentage CPU and memory usage against pod limits, safely parsing both string and numeric metric representations without runtime exceptions, and falling back to pod resource limits when the metrics server is unavailable without failing the dashboard view.

#### Scenario: Monitoring active build resource consumption
- **WHEN** a Kpack build pod is actively executing
- **THEN** the dashboard queries `metrics.k8s.io/v1beta1`, computes memory and CPU percentage against pod resource limits, and updates real-time radial gauges every 5 seconds

#### Scenario: Metrics server unavailable
- **WHEN** the Kubernetes metrics server is unreachable or reports 404
- **THEN** the dashboard renders fallback indicators showing resource limits without failing the dashboard view

#### Scenario: Numeric or unformatted resource quantity inputs
- **WHEN** the metrics client returns numeric values or strings without standard Kubernetes unit suffixes
- **THEN** the quantity parser converts and scales the inputs safely without throwing unhandled type errors
