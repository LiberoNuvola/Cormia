# ADR-0005: Cormia as the user-facing product identity

- **Status:** Accepted as working product identity; trademark and domain clearance pending
- **Date:** 2026-11-02

## Context

The IMMORTAL name and jellyfish symbol express regeneration, continuity, and the ability to recover and renew. The new user-facing network needs a distinct, ownable-sounding identity that does not replace IMMORTAL or confuse the product with the normative protocol.

The biological inspiration has two related but distinct references:

1. *Turritopsis dohrnii*, commonly called the immortal jellyfish, is known for its ability under certain conditions to reverse its life-cycle development from the medusa stage toward a polyp stage. It is not, in its adult medusa stage, a colony of separate organisms.
2. Siphonophores are colonial hydrozoans made of physiologically integrated, specialized zooids. A *cormidium* is one repeated sequence/pattern of zooids along the siphonophore stem; it is a modular unit within the colony, not the name for the whole colony.

The biological analogy is a source of inspiration, not a literal model: unlike many siphonophore zooids, Cormia's computers and nodes must remain independently owned, autonomous, and able to join or leave the network.

## Decision

Use **Cormia** as the user-facing product and network name, while preserving IMMORTAL as the umbrella and AEP as the normative protocol.

Naming layers:

- **IMMORTAL** — wider project and protocol ecosystem; retains the jellyfish/medusa identity.
- **Cormia** — the user-facing product and peer-to-peer AI network.
- **IMMORTAL Autonomous Execution Protocol (AEP)** — normative rules for task commitments, capabilities, state transitions, verification, disputes, reciprocity accounting, settlement, and governance.
- **Cormia Node** — a participant's installed node software.
- **Cormia Runtime** — bounded local and remote task execution within the node.
- **Cormia Mesh** — the peer-to-peer network formed by participating nodes.
- **Compute Reciprocity Credits (CRC)** — provisional non-transferable access accounting, not a tradable or cash-redeemable asset in the initial design.

The product name **Cormia** is a coined name inspired by *cormidium*. It is not a zoological term, nor does it assert biological equivalence between a software network and a siphonophore colony.

Proposed tagline: **Your AI locally. Shared intelligence when you contribute.**

## Rationale

Cormia refers indirectly to repeated, specialized modules cooperating within a larger integrated system. This is a better metaphor for a distributed software network than “Hive”, while remaining distinct from the already selected IMMORTAL identity and symbol.

The name also creates a clear product/protocol split: users join Cormia; implementations conform to IMMORTAL AEP.

## Consequences

- Repository slug: `LiberoNuvola/cormia`.
- The existing `LiberoNuvola/Immortal-Protocol` remains separate and is not renamed or replaced.
- Existing local Agent, Flux Point, JEV, and Mitsuro work remains preserved as integration input; source migration still requires an explicit mapping, license review, tests, and rollback path.
- No claim is made that Cormia is trademark-cleared, that domains are available, or that the name is globally unique. Legal and domain checks remain release gates.

## Biological references

- [Oxford Academic — Glossary of siphonophore terms](https://academic.oup.com/view-large/429764915): defines cormidium as a reiterating sequence of zooids along the stem.
- [Dunn (2005), Complex colony-level organization of the deep-sea siphonophore *Bargmannia elongata*](https://doi.org/10.1002/dvdy.20483): describes a cormidium as one iteration of the repeating zooid pattern and a colonial animal as physiologically integrated zooids.
- [Treccani — Sifonofori](https://www.treccani.it/vocabolario/sifonofori/): Italian overview of siphonophore colonies and their polypoid/medusoid individuals.
- [Global Diversity and Review of Siphonophorae](https://doi.org/10.1371/journal.pone.0087737): review of siphonophore diversity and cormidia.
