# Compute reciprocity test vectors

`provisional-receipt.example.json` is a shape/example fixture for the draft JSON Schema. Its signatures are placeholders, its hashes are artificial, and it is not cryptographic evidence. It represents a **provisional** service receipt and MUST NOT mint spendable CRC.

Required future semantic tests include: provisional receipt does not credit; duplicate nonce rejected; receipt for unknown task rejected; wrong model/runtime digest rejected; challenged receipt frozen; revoked contributor rejected; missing peer acknowledgement cannot be silently accepted; blinded input commitment validation; epoch-root inclusion/non-inclusion proof; requester/worker collusion and replay scenarios.

The example input commitment is an artificial stand-in for a blinded commitment. Production code must not publish a bare hash of a guessable prompt.
