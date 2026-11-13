# Colibrì local inference adapter

**Status:** experimental compatibility slice; not wired into the Agent or a live Cormia Runtime.  
**Decision:** ADAPT the upstream HTTP interface; do not copy, fork, vendor or modify the Colibrì engine.

## Upstream reviewed

- Project: [JustVugg/colibri](https://github.com/JustVugg/colibri)
- Reviewed release: [v2.1.0](https://github.com/JustVugg/colibri/releases/tag/v2.1.0)
- Engine license: Apache-2.0 ([LICENSE](https://github.com/JustVugg/colibri/blob/v2.1.0/LICENSE), [NOTICE](https://github.com/JustVugg/colibri/blob/v2.1.0/NOTICE)).
- API contract: [OpenAI-compatible API](https://github.com/JustVugg/colibri/blob/v2.1.0/docs/api.md).
- Reference GLM-5.2 artifact: [mastouri/GLM-5.2-colibri-int4-g64-with-int8-mtp](https://huggingface.co/mastouri/GLM-5.2-colibri-int4-g64-with-int8-mtp), whose model card declares MIT and identifies zai-org/GLM-5.2 as the MIT base model.

The runtime and model weights are separate licensed artifacts. The adapter does not redistribute either one. Re-check the exact binary release, notices, model card, artifact revision and checksums before deployment; this record is not a legal opinion or a supply-chain attestation.

## Boundary and API

`colibri-inference-adapter.mjs` is a small Node client for a locally running `coli serve` process. It exposes only:

- `GET /v1/models` through `listModels()`;
- non-streaming `POST /v1/chat/completions` through `chatCompletion()`.

The default endpoint is `http://127.0.0.1:8000/v1`. Only explicit loopback hosts (`127.0.0.1`, `localhost`, `[::1]`) and the `/v1` path are accepted. Redirects are rejected. An optional API key is supplied by trusted host configuration; the adapter never returns or logs it. The adapter does not start/stop Colibrì, install binaries, download weights, or read environment variables.

The reviewed Colibrì API documents OpenAI `tools` support for GLM-5.2. Its GLM `strict_tool_calls` option validates complete function calls against the declared schema and returns an error for malformed/unknown/invalid calls. Strict mode requires `stream: false` and does not support `logprobs`; this adapter always sends `stream: false` and does not expose `logprobs`.

Returned tool calls are **model proposals only**. This adapter never executes them. Cormia's trusted capability/policy layer must validate the tool name, arguments, task scope and current authority before dispatch. An API-compatible tool call is not an authorization decision, execution receipt, proof of useful work, or accepted task result.

The adapter marks `finish_reason: "length"` as incomplete and returns only bounded token usage fields. Upstream error bodies are not copied into thrown error messages, to avoid echoing prompt or tool payloads into ordinary diagnostics.

## Resource and lifecycle composition

The adapter is deliberately separate from the existing Resource Manager adapter. A future trusted Runtime composes the two:

1. select the model/provider from host policy, not model/task output;
2. acquire the existing `agent-inference` Resource Manager lease;
3. call this adapter against the configured local Colibrì endpoint;
4. release the lease in a `finally` block;
5. pass any returned tool proposal to the normal capability/policy dispatcher.

This module does not schedule requests, enforce OS quotas, implement peer inference, issue CRC, sign compute receipts, or invoke Cardano. It does not replace the existing Granite/llama.cpp path.

## Security and operational gates before live use

- Pin the Colibrì release and record the exact release-archive SHA-256 for the host OS/architecture. Do not follow a floating `main` binary.
- Verify the chosen model repository revision and all downloaded model/tokenizer artifacts against a separately recorded manifest/checksum. The model directory is a native-code loader trust boundary, not inert data.
- Review the current [Colibrì security advisories](https://github.com/JustVugg/colibri/security/advisories) and confirm the selected binary contains the required fixes. The GLM-5.2 model card itself warns about historical model-loader advisories and recommends a patched loader; this compatibility slice does not independently establish the fix status of a particular archive.
- Keep `coli serve` bound to loopback. Do not expose the endpoint to LAN/Internet or route prompts remotely in this local-only slice.
- Use the grouped-scale int4 GLM-5.2 container identified by the upstream model card, not older per-row mirrors that the upstream card warns can have quality/stopping problems.
- The reference GLM-5.2 package is about 429 GB. A successful adapter test does not mean the local machine has the disk/RAM/throughput to run it.

## Verification

Run from the repository root:

```powershell
node --check .\\runtime\\reference-worker\\colibri-inference-adapter.mjs
node --test .\\runtime\\reference-worker\\colibri-inference-adapter.test.mjs
```

The 10 contract tests use a mocked OpenAI-compatible endpoint. They verify loopback restrictions, fixed API paths, host-held bearer authentication, strict non-streaming tool-call request shape, incomplete-generation classification, bounded upstream errors, malformed responses, transport failures, enforced request timeouts and caller cancellation. They do **not** install or execute Colibrì, download a model, verify a real server, benchmark hardware, or prove model quality/tool-call reliability on a specific checkpoint.
