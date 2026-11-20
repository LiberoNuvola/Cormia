# Decentralized inference and reciprocal compute — prior-art review

**Research snapshot:** 2 November 2026  
**Scope:** peer-powered inference, volunteer compute, contributor credits, model distribution, privacy and local-first access.  
**Rule:** distinguish project claims and documented implementation state from independently verified guarantees.

## 1. Comparison

| Project / system | Relevant idea | Current evidence / limitation | AEP reuse direction |
|---|---|---|---|
| **Senda** | Open peer-to-peer LLM mesh, free chat without account, volunteer nodes, capability-aware routing, contributor credits, a model identity fingerprint plus synthetic probes. | Site labels service early access and says mesh latency/uptime vary. Contributor credits are not cash; paid API and Peer USD are preview-grade. Its security page says serving peers can read prompts, no TEE/encrypted-inference guarantee exists today, and current model-fingerprint checks are observe-mode rather than routing enforcement. | Closest prior art for user-facing model: local/mesh roles and contribution accounting. Do not claim the reciprocity idea itself is novel. Study its receipt and synthetic-probe design, but design AEP CRC as a non-transferable quota for shared inference with independent reconstruction and Cardano epoch commitments. |
| **Decoupled AI / d-compute** | Peer-to-peer inference, user hardware serving model shards, credits for contribution, open-source Rust daemon and libp2p/Noise direction. | Its page identifies d-compute as a developer preview. It states single-node GGUF inference works, while real layer-sliced execution is still simulated/in progress and on-chain escrow is specified but not built. Claims such as “zero logs” or privacy must be independently assessed. | Study node/runtime separation, gossip/discovery, model placement and credit idea. Do not assume distributed pipeline or cryptographic guarantees are production-ready. Benchmark the released source before any code reuse. |
| **Petals** | Collaborative inference by splitting transformer layers across volunteer GPU nodes; client uses a distributed model interface. | Public README explains that prompts are processed with help from other people in the swarm and recommends a private swarm for sensitive data. High-throughput model collaboration is not the same as a low-latency consumer-credit economy. | Best technical prior art for a later split-model execution mode. Start AEP with whole-model serving where a model fits on one peer; introduce layer splitting only after measuring network latency, failure recovery and privacy leakage. |
| **BOINC** | Volunteer computing, work units, duplicate execution, result comparison and credits granted after agreement. | Designed for scientific/batch work and throughput, not streaming token generation. Replication is useful but consumes extra compute and does not fully solve collusion/Sybil behavior. | Reuse accepted-work accounting, delayed credit finality, replay/retry and replication principles. Adapt validation to stochastic inference rather than applying exact-output comparison indiscriminately. |
| **Golem** | Permissionless provider/requestor compute marketplace; providers contribute hardware and receive GLM. | Native-token compensation creates a wallet/payment requirement for the commercial provider path. This is not the token-free consumer model we want. | Study resource offers, provider lifecycle and P2P compute protocol; keep tokenized marketplace optional and separate from CRC in AEP v1. |
| **Morpheus Lumerin Node** | Local `llama.cpp` demo model plus decentralized provider marketplace. | Documentation states that local demo chat can run without staking MOR; marketplace sessions use MOR staking and ETH for gas on Base. | Useful precedent for separating local no-wallet inference from remote paid marketplace access. AEP goes further with compute reciprocity as an alternative to payment for mesh usage. |
| **OpenMayhem / Infernet / similar inference markets** | Provider marketplaces, P2P routing, verification or attestation claims. | Mostly price-based or token/payment models; maturity and guarantees vary by repository and deployment. | Track as competing architectures; do not adopt claims without code, threat-model and operational validation. |


## 1A. Adjacent prior art: local post-training with constrained GPU memory — Soup CLI

**Classification:** local model fine-tuning / post-training, not decentralized inference and not a peer-compute network.

[Soup CLI](https://github.com/MakazhanAlpamys/Soup) is an open-source (Apache-2.0) toolkit for local LLM training and post-training. Its optional **Layer Streaming** mode keeps the frozen base checkpoint in host RAM, with an NVMe-backed tier when needed, and copies one decoder layer at a time into a small set of VRAM buffers. Trainable LoRA adapters, gradients and optimizer state remain resident on the training device. The aim is to make selected fine-tuning runs possible on a GPU that cannot hold the full base model.

The documented 8B-on-4GB example is a **Llama-3.1-8B-Instruct NF4 + LoRA** run on an RTX 3050 Laptop. Soup's own documentation distinguishes an earlier 3.32 GB measurement (v0.72.2, before a later NF4 correctness repair) from a 2.40 GB post-repair report on another machine/clock; these figures are not a controlled like-for-like comparison. Layer Streaming is explicitly marked **BETA**. They are project-reported measurements, not a general guarantee for arbitrary 8B models or hardware.

**What this does and does not mean**

- It reduces the *peak VRAM residency* of the frozen base by streaming layers; it does not remove the need to store the model, perform the training computation, or provide sufficient host RAM / NVMe capacity and bandwidth.
- It is a fine-tuning/post-training technique for a frozen base plus trainable parameters; it must not be described as making full pretraining of an arbitrarily large model practical on a tiny machine.
- It is not Petals-style distributed inference, model sharding across independent peers, or a contribution-credit network. Its resource placement and trust boundary are local to the training host.
- Soup's recipe catalog contains a Granite 4.0 H Tiny base recipe (7B); that does **not** establish support for the project's existing Granite 4.2 8B GGUF model or for its exact Transformers checkpoint and LoRA target modules. The current GGUF inference file must not be assumed to be a directly trainable source checkpoint.

**Cormia reuse direction — candidate, not adopted**

Evaluate Soup as an optional backend for a local **Model Adaptation / Training Lab**: produce narrowly scoped adapters for agent roles or project domains on participant-owned hardware, then evaluate and distribute approved adapter artifacts. Keep this separate from Cormia Mesh inference and from AEP/IMMORTAL authority.

Every candidate adapter should be traceable to at least: exact base-model identifier and digest; dataset manifest, permissions and content digest; Soup/package version and training configuration; hardware/precision profile; training-run identifier; evaluation suite/version and results; adapter digest; and the approval/promotion decision. Adapter contents must never grant tool permissions, widen a Project Mandate, change Runtime policy, or become an authority source.

**Bounded evaluation spike (SOUP-01)**

1. Run Soup's preflight/doctor and a supported reference recipe in an isolated environment; record GPU VRAM, system RAM, free NVMe space, Python/CUDA/PyTorch versions and the exact package/tag.
2. Compare resident and streamed training on the same small reference dataset where supported; record peak VRAM, host RAM, disk I/O, throughput, loss behavior and forward/backward parity evidence.
3. Test the exact target base checkpoint and LoRA target modules separately. For Granite, treat Granite 4.0 H Tiny as a reference recipe only; Granite 4.2 8B remains **unverified** until its exact Hugging Face/Transformers checkpoint passes model-load, adapter-attach, short-train, save/resume and evaluation checks.
4. Export a candidate adapter and run held-out regression/safety/effectiveness evaluations before any registry promotion. Do not merge it into the canonical base or deploy it automatically.

No Soup dependency, code, training job, runtime integration, model promotion or authority change is introduced by this prior-art entry.

**Sources**

- Soup repository and license: https://github.com/MakazhanAlpamys/Soup
- Layer Streaming guide and constraints: https://trysoup.dev/docs/layer-streaming
- FAQ / model and memory notes: https://trysoup.dev/docs/faq
- Recipe catalog (including Granite 4.0 H Tiny): https://trysoup.dev/docs/recipe-catalog
- Product and licensing information: https://trysoup.dev/about
- Layer-streaming paper: https://doi.org/10.5281/zenodo.21918325

**Reviewed:** 2026-11-06. Re-check the exact release/tag, supported architectures, license notices, feature maturity and model-specific behavior before any trial.

## 2. Key conclusions

1. “Share your compute and get free AI” is already an active design space. Senda and Decoupled AI make the overlap especially direct.
2. “No token” needs a precise definition. AEP should mean no customer-facing crypto token, no API-token meter, no subscription and no mandatory wallet for local/reciprocal use. An internal non-transferable usage-right ledger is still accounting, not a cryptocurrency.
3. Local inference and remote inference have different cost and privacy properties. Local inference costs the user electricity/hardware but does not expose prompts to another peer. Remote inference uses someone else's resources and gives the selected peer access to prompt plaintext unless a stronger privacy mechanism is implemented.
4. Full-model serving on a single peer should be the first mesh mode. Split-model inference is a later optimization for models too large for a single contributor. It increases network synchronization and privacy complexity.
5. Credit issuance should follow useful, accepted service with evidence. Do not reward “node online” time, declared hardware or raw output tokens alone.
6. Inference answer correctness is difficult to verify because generation can be stochastic. Model-identity fingerprinting, synthetic probes, signed receipts, sampled replay, selective replication, task-specific evaluation and optional TEE/ZK profiles solve different problems and must not be collapsed into a single “proof of compute” claim.
7. AEP's likely contribution is not the credit idea itself. It is the normative integration with task manifests, capabilities, Resource Manager, Flux Point DoD/graph gates, JEV evidence, Mitsuro read-only observation, persistent recovery, Cardano epoch anchoring, challenge and governance.

## 3. Proposed AEP composition

- **Local-first runtime:** keep the existing IMMORTAL Local Agent/Granite nucleus as the first worker; local-only mode always works without account or wallet.
- **Worker engine:** model gateway, Resource Manager, signed model catalog, bounded inference service, opt-in scheduler and local safety policy.
- **Peer network:** capability advertisements, peer discovery, routing, session setup and health; avoid a privileged global router as a consensus authority.
- **Reciprocity accounting:** non-transferable CRC based on verified useful work; no fixed fiat value and no native customer token.
- **Evidence:** JEV-normalized receipts/verdicts; Flux Point harness checks engineering campaigns and code artefacts; Mitsuro exposes only existing read-only evidence tools.
- **On-chain:** batch epoch commitments, task escrow for optional high-value jobs, bonds/challenges and governance. No per-chat transaction and no requirement for a wallet in local-only mode.

## 4. Security and privacy cautions

- P2P transport encryption does not hide plaintext from the chosen inference peer.
- Open-source runtime improves inspectability but cannot prove a machine operator does not inspect RAM or alter the host environment.
- Model fingerprint probes can show a peer appears to run the advertised model; they do not prove every request was executed correctly.
- A signed receipt proves who signed a statement, not that the GPU performed the claimed work.
- Multiple replicas do not provide independence if operators are Sybil identities under common control.
- TEE claims depend on chip vendor, firmware, attestation roots, revocation and side-channel assumptions.
- ZK proofs may prove a precisely encoded computation; they do not prove the model is useful, the prompt is truthful or the test is adequate.
- Worker nodes must not accept arbitrary user shell/code through the inference-only donation path.

## 5. Source register

- Senda overview: https://senda.network/
- Senda contribution credits: https://senda.network/contribute
- Senda privacy: https://senda.network/privacy
- Senda security/threat model: https://senda.network/security
- Decoupled AI / d-compute status: https://decoupled.ai/
- Petals source and privacy note: https://github.com/bigscience-workshop/petals
- BOINC work/credit lifecycle: https://boinc.berkeley.edu/intro.php
- BOINC validator and replication model: https://github.com/BOINC/boinc/wiki/Validators
- BOINC credit paper: https://boinc.berkeley.edu/boinc_papers/credit/text.php
- Golem provider model: https://docs.golem.network/docs/providers
- Morpheus local inference and marketplace distinction: https://nodedocs.mor.org/get-started/introduction
- AEP existing Flux Point pilot: `LiberoNuvola/Immortal-Protocol/docs/04-verification/FLUXPOINT-DOD-PILOT.md`
- AEP existing Mitsuro/JEV bridge: `LiberoNuvola/Immortal-Protocol/integrations/mitsuro/README.md`

Reviewed 2 November 2026. Re-check releases, repository activity, source licences, deployment claims and threat models before selecting code for reuse.
