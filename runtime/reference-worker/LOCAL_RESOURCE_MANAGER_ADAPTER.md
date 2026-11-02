# Local Resource Manager adapter

**Status:** implemented as a trusted-orchestrator wrapper; no local Agent code changed.

The existing local ResourceManager exposes `snapshot()`, `acquire(kind, snapshot)` and an idempotent `release()` closure. The Cormia wrapper is a deliberately narrow adapter over those methods.

## Fixed operation mapping

| Trusted Runtime operation | Existing ResourceManager class |
|---|---|
| `agent-inference` | `model-inference` |
| `workspace-test` | `cpu-heavy` |
| `evolution-docker-test` | `cpu-heavy` |

The operation identifier must be selected by trusted orchestration code, not by model output or task text. There is no caller-supplied free-form ResourceManager class, and GPU-heavy work is not mapped because the reviewed Agent does not currently use that class in its execution path.

## Contract

`withLocalResourceLease({ resourceManager, operation, run })`:

1. rejects unknown operation identifiers;
2. obtains a fresh ResourceManager snapshot;
3. fails closed if the manager is unavailable or snapshotting fails;
4. acquires the fixed resource class mapped to the trusted operation;
5. does not invoke `run` when the lease is denied;
6. requires a release callback before running;
7. releases the lease in `finally`, including when the action throws;
8. returns a bounded resource summary without exposing the full host object.

This helper does not replace ResourceManager policy, create OS-level quotas, monitor/terminate jobs, persist leases, or schedule work. The original manager's counters are in-memory and process-local.

The wrapper is not connected to `agent.mjs`; it is a Cormia-side compatibility component for a future trusted Runtime. It does not accept AEP tasks, decide capabilities, or authorize filesystem/tool operations.

## Source-derived limits

- Resource snapshots sample CPU over a short interval and query optional NVIDIA telemetry using a fixed `nvidia-smi` argument list with `shell: false`.
- Resource classes in the existing manager are `light-read`, `model-inference`, `cpu-heavy` and `gpu-heavy`.
- Lease limits are process-local and depend on the captured recommendation.
- Release must be called by the trusted caller; the class cannot enforce host CPU/RAM/VRAM consumption.
- A missing CPU telemetry sample fails closed for heavy CPU work under the current policy.
- The reviewed Agent uses `model-inference` around model turns and `cpu-heavy` around workspace/evolution Docker tests.

## Tests

Run from this directory:

```powershell
node --test .\immortal-resource-manager-adapter.test.mjs
```
