import {
  authorizeLocalProjectOperation,
  deriveLocalProjectTaskAuthority,
  validateLocalAutonomousProjectMandateClaims
} from "../reference-worker/local-autonomous-project-authority.mjs";

const PROJECT_DESCRIPTOR_TYPE = "cormia.core.project-descriptor";
const PROJECT_DESCRIPTOR_SCHEMA_VERSION = "0.1.0";
const MANDATE_CLAIMS_SCHEMA_ID = "urn:immortal-aep:schema:local-autonomous-project-mandate:0.1.0";
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROJECT_STATES = new Set([
  "draft", "configured", "active", "paused", "blocked", "completed", "archived"
]);
const CONSENT_KEYS = [
  "schemaVersion", "consentId", "issuerId", "operatorPrincipalId", "consentBrokerId",
  "mandateId", "mandateDigest", "projectRef", "workspaceRef", "decision",
  "interactionMode", "interactionId", "displayedChallenge", "confirmedChallenge",
  "issuedAt", "expiresAt", "nonce", "sequence"
];
const HOST_POLICY_KEYS = [
  "issuerId", "projectRef", "repositoryRef", "workspaceRef", "workerId", "runtimeId",
  "allowedOperations", "excludedPaths", "allowedExecutionProfiles", "allowedHttpsHosts"
];

export class TrustedProjectResolutionError extends Error {
  constructor(message, code = "PROJECT_RESOLUTION_BLOCKED") {
    super(message);
    this.name = "TrustedProjectResolutionError";
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string")) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (actual.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  const sorted = actual.sort();
  const expected = [...keys].sort();
  return sorted.length === expected.length && sorted.every((key, index) => key === expected[index]);
}

function hasOnlyKeys(value, required, optional = []) {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (actual.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  return required.every(key => Object.hasOwn(value, key));
}

function isText(value, max = 512) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

function parseTime(value) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : NaN;
}

function resolveNow(clock) {
  const value = clock();
  const milliseconds = value instanceof Date ? value.getTime() :
    typeof value === "string" ? Date.parse(value) :
    typeof value === "number" ? value : NaN;
  if (!Number.isFinite(milliseconds)) {
    throw new TrustedProjectResolutionError("Trusted host clock is invalid.", "PROJECT_RESOLVER_CLOCK_INVALID");
  }
  return milliseconds;
}

function validateHostContext(hostContext) {
  if (!hasExactKeys(hostContext, [
    "issuerId", "projectRef", "repositoryRef", "workspaceRef", "workerId", "runtimeId"
  ]) || Object.values(hostContext).some(value => !isText(value))) {
    throw new TypeError("hostContext must be a complete host-resolved identity binding.");
  }
  return Object.freeze({ ...hostContext });
}

function validateDescriptor(descriptor, expectedProjectRef) {
  const required = [
    "schemaVersion", "recordType", "projectRef", "displayName", "leadershipMode",
    "stewardRef", "accountabilityRef", "mandateRef", "createdAt", "updatedAt", "revision"
  ];
  const optional = ["missionRef", "visibilityPolicyRef"];
  if (!hasOnlyKeys(descriptor, required, optional) ||
      descriptor.schemaVersion !== PROJECT_DESCRIPTOR_SCHEMA_VERSION ||
      descriptor.recordType !== PROJECT_DESCRIPTOR_TYPE ||
      descriptor.projectRef !== expectedProjectRef ||
      !isText(descriptor.displayName, 160) ||
      !["creator_team_led", "agent_led", "hybrid"].includes(descriptor.leadershipMode) ||
      !isText(descriptor.stewardRef) ||
      !isText(descriptor.accountabilityRef) ||
      !isText(descriptor.createdAt) || !Number.isFinite(parseTime(descriptor.createdAt)) ||
      !isText(descriptor.updatedAt) || !Number.isFinite(parseTime(descriptor.updatedAt)) ||
      !Number.isSafeInteger(descriptor.revision) || descriptor.revision < 1 ||
      (descriptor.missionRef !== undefined && !isText(descriptor.missionRef)) ||
      (descriptor.visibilityPolicyRef !== undefined && !isText(descriptor.visibilityPolicyRef)) ||
      !hasExactKeys(descriptor.mandateRef, ["mandateId", "claimsSchemaId", "claimsDigest"]) ||
      !isText(descriptor.mandateRef.mandateId) ||
      descriptor.mandateRef.claimsSchemaId !== MANDATE_CLAIMS_SCHEMA_ID ||
      typeof descriptor.mandateRef.claimsDigest !== "string" ||
      !DIGEST_PATTERN.test(descriptor.mandateRef.claimsDigest)) {
    throw new TrustedProjectResolutionError(
      "Project Descriptor is invalid or is not bound to the host-selected project.",
      "PROJECT_DESCRIPTOR_INVALID"
    );
  }
  return descriptor;
}

function validateStewardResolution(result, descriptor) {
  if (!hasExactKeys(result, ["status", "principalRef", "principalType"]) ||
      result.status !== "verified" ||
      result.principalRef !== descriptor.stewardRef ||
      !["human", "organization"].includes(result.principalType)) {
    throw new TrustedProjectResolutionError(
      "Steward reference did not resolve to a verified human or organization principal.",
      "PROJECT_STEWARD_UNRESOLVED"
    );
  }
  return result;
}

function validateAccountabilityResolution(result, descriptor) {
  if (!hasExactKeys(result, ["status", "arrangementRef", "accountablePrincipalRefs"]) ||
      result.status !== "verified" ||
      result.arrangementRef !== descriptor.accountabilityRef ||
      !Array.isArray(result.accountablePrincipalRefs) ||
      !result.accountablePrincipalRefs.every(item => isText(item)) ||
      new Set(result.accountablePrincipalRefs).size !== result.accountablePrincipalRefs.length ||
      !result.accountablePrincipalRefs.includes(descriptor.stewardRef)) {
    throw new TrustedProjectResolutionError(
      "Accountability arrangement is not verified or does not include the declared steward.",
      "PROJECT_ACCOUNTABILITY_UNRESOLVED"
    );
  }
  return result;
}

function validateMandateResolution(result, descriptor, hostContext, nowMs) {
  if (!hasExactKeys(result, [
    "verificationStatus", "keyStatus", "mandateStatus", "issuerId", "claimsDigest", "claims"
  ]) ||
      result.verificationStatus !== "verified" ||
      result.keyStatus !== "active" ||
      result.mandateStatus !== "active" ||
      result.issuerId !== hostContext.issuerId ||
      result.claimsDigest !== descriptor.mandateRef.claimsDigest ||
      typeof result.claimsDigest !== "string" || !DIGEST_PATTERN.test(result.claimsDigest)) {
    throw new TrustedProjectResolutionError(
      "Mandate signature, active key, mandate status or claims digest is not trusted.",
      "PROJECT_MANDATE_UNTRUSTED"
    );
  }

  const verdict = validateLocalAutonomousProjectMandateClaims(result.claims);
  if (!verdict.valid) {
    throw new TrustedProjectResolutionError(
      "Existing ADR-0010 mandate claims failed their current v0.1 validator: " + verdict.reason,
      "PROJECT_MANDATE_CLAIMS_INVALID"
    );
  }
  const claims = result.claims;
  if (claims.issuerId !== hostContext.issuerId ||
      claims.project.projectRef !== descriptor.projectRef ||
      claims.project.repositoryRef !== hostContext.repositoryRef ||
      claims.workspace.workspaceRef !== hostContext.workspaceRef ||
      claims.subject.workerId !== hostContext.workerId ||
      claims.subject.runtimeId !== hostContext.runtimeId) {
    throw new TrustedProjectResolutionError(
      "Mandate project, repository, workspace, worker or Runtime binding differs from the host context.",
      "PROJECT_MANDATE_BINDING_MISMATCH"
    );
  }
  const notBefore = parseTime(claims.notBefore);
  const expiresAt = parseTime(claims.expiresAt);
  if (notBefore > nowMs || expiresAt <= nowMs) {
    throw new TrustedProjectResolutionError(
      notBefore > nowMs ? "Project mandate is not yet valid." : "Project mandate has expired.",
      notBefore > nowMs ? "PROJECT_MANDATE_NOT_YET_VALID" : "PROJECT_MANDATE_EXPIRED"
    );
  }
  return claims;
}

function validateConsentResolution(result, mandateClaims, mandateDigest, descriptor, hostContext, nowMs) {
  if (!hasExactKeys(result, [
    "verificationStatus", "receiptStatus", "replayStatus", "receiptDigest", "claims"
  ]) ||
      result.verificationStatus !== "verified" ||
      result.receiptStatus !== "active" ||
      result.replayStatus !== "valid" ||
      result.receiptDigest !== mandateClaims.operatorConsentDigest ||
      typeof result.receiptDigest !== "string" ||
      !DIGEST_PATTERN.test(result.receiptDigest) ||
      !hasExactKeys(result.claims, CONSENT_KEYS)) {
    throw new TrustedProjectResolutionError(
      "Project mandate consent receipt is missing, unverified, inactive or replay-invalid.",
      "PROJECT_CONSENT_UNTRUSTED"
    );
  }
  const consent = result.claims;
  if (consent.schemaVersion !== "0.1.0" ||
      !UUID_PATTERN.test(consent.consentId) ||
      !UUID_PATTERN.test(consent.mandateId) ||
      !UUID_PATTERN.test(consent.interactionId) ||
      !UUID_PATTERN.test(consent.nonce) ||
      !Number.isSafeInteger(consent.sequence) || consent.sequence < 1 ||
      !isText(consent.consentBrokerId) ||
      consent.issuerId !== mandateClaims.issuerId ||
      consent.operatorPrincipalId !== mandateClaims.operatorPrincipalId ||
      consent.mandateId !== mandateClaims.mandateId ||
      consent.mandateDigest !== mandateDigest ||
      consent.projectRef !== descriptor.projectRef ||
      consent.workspaceRef !== hostContext.workspaceRef ||
      consent.decision !== "approve" ||
      consent.interactionMode !== "local-interactive-project-mandate" ||
      !/^[a-f0-9]{8}$/.test(consent.displayedChallenge) ||
      consent.displayedChallenge !== consent.confirmedChallenge ||
      consent.displayedChallenge !== mandateDigest.slice(-8) ||
      !Number.isFinite(parseTime(consent.issuedAt)) ||
      !Number.isFinite(parseTime(consent.expiresAt)) ||
      parseTime(consent.issuedAt) > nowMs ||
      parseTime(consent.expiresAt) <= nowMs) {
    throw new TrustedProjectResolutionError(
      "Project mandate consent receipt does not bind the approved mandate, project, workspace, operator or challenge.",
      "PROJECT_CONSENT_BINDING_MISMATCH"
    );
  }
  return consent;
}

function validateRevocationResolution(result) {
  if (!hasExactKeys(result, [
    "status", "mandateState", "anchorProviderId", "sequence", "headEventDigest"
  ]) ||
      result.status !== "HEALTHY" ||
      result.mandateState !== "active" ||
      !isText(result.anchorProviderId) ||
      !Number.isSafeInteger(result.sequence) || result.sequence < 0 ||
      !(result.headEventDigest === null ||
        (typeof result.headEventDigest === "string" && DIGEST_PATTERN.test(result.headEventDigest)))) {
    throw new TrustedProjectResolutionError(
      "Project mandate revocation state or independent anchor is not healthy.",
      "PROJECT_MANDATE_REVOCATION_UNHEALTHY"
    );
  }
  return result;
}

function validateLifecycleProjection(result, projectRef) {
  if (!isPlainObject(result) ||
      result.projectRef !== projectRef ||
      !Number.isSafeInteger(result.revision) || result.revision < 0 ||
      !Object.hasOwn(result, "state") ||
      !(result.state === null || PROJECT_STATES.has(result.state)) ||
      (result.revision === 0 && result.state !== null) ||
      (result.revision > 0 && result.state === null)) {
    throw new TrustedProjectResolutionError(
      "Project lifecycle journal projection is invalid or belongs to another project.",
      "PROJECT_LIFECYCLE_PROJECTION_INVALID"
    );
  }
  return result;
}

function validateHostPolicy(result, hostContext) {
  if (!hasExactKeys(result, HOST_POLICY_KEYS) ||
      result.issuerId !== hostContext.issuerId ||
      result.projectRef !== hostContext.projectRef ||
      result.repositoryRef !== hostContext.repositoryRef ||
      result.workspaceRef !== hostContext.workspaceRef ||
      result.workerId !== hostContext.workerId ||
      result.runtimeId !== hostContext.runtimeId) {
    throw new TrustedProjectResolutionError(
      "Host policy is missing or bound to another host/project/workspace context.",
      "PROJECT_HOST_POLICY_BINDING_MISMATCH"
    );
  }
  for (const field of ["allowedOperations", "excludedPaths", "allowedExecutionProfiles", "allowedHttpsHosts"]) {
    if (!Array.isArray(result[field]) ||
        !result[field].every(item => isText(item, field === "excludedPaths" ? 512 : 256)) ||
        new Set(result[field]).size !== result[field].length) {
      throw new TrustedProjectResolutionError("Host policy contains an invalid " + field + " set.", "PROJECT_HOST_POLICY_INVALID");
    }
  }
  return result;
}

function requireProviderFunction(provider, method, label) {
  if (!provider || typeof provider[method] !== "function") {
    throw new TypeError("Missing trusted " + label + "." + method + " provider.");
  }
}

/**
 * Build a host-only project resolver. All providers are trusted Runtime ports,
 * captured at construction and never supplied by a task or model.
 *
 * This is an orchestration boundary, not a cryptographic implementation:
 * ADR-0009's mandate-signature, authenticated-consent, identity and independent
 * mandate-revocation providers are not yet implemented in this repository.
 */
export function createTrustedProjectResolver({
  hostContext,
  projectStore,
  identityProvider,
  mandateAuthority,
  consentAuthority,
  revocationAuthority,
  hostPolicyProvider,
  projectLifecycleJournal,
  clock = () => new Date()
} = {}) {
  const expectedHost = validateHostContext(hostContext);
  requireProviderFunction(projectStore, "readProjectDescriptor", "project store");
  requireProviderFunction(identityProvider, "resolveSteward", "identity");
  requireProviderFunction(identityProvider, "resolveAccountability", "identity");
  requireProviderFunction(identityProvider, "authorizeMandateOperator", "identity");
  requireProviderFunction(mandateAuthority, "verifyAndLoad", "mandate authority");
  requireProviderFunction(consentAuthority, "verifyActiveReceipt", "consent authority");
  requireProviderFunction(revocationAuthority, "reconcileMandate", "mandate revocation");
  requireProviderFunction(hostPolicyProvider, "readPolicy", "host policy");
  requireProviderFunction(projectLifecycleJournal, "read", "project lifecycle journal");
  if (typeof clock !== "function") throw new TypeError("clock must be a trusted host function.");

  async function loadTrustedContext() {
    try {
      const nowMs = resolveNow(clock);
      const descriptor = validateDescriptor(
        await projectStore.readProjectDescriptor(expectedHost.projectRef),
        expectedHost.projectRef
      );

      const steward = validateStewardResolution(
        await identityProvider.resolveSteward(descriptor.stewardRef),
        descriptor
      );
      const accountability = validateAccountabilityResolution(
        await identityProvider.resolveAccountability(descriptor.accountabilityRef),
        descriptor
      );

      const mandateResolution = await mandateAuthority.verifyAndLoad({
        mandateId: descriptor.mandateRef.mandateId,
        claimsSchemaId: descriptor.mandateRef.claimsSchemaId,
        expectedClaimsDigest: descriptor.mandateRef.claimsDigest,
        expectedHost,
        now: new Date(nowMs).toISOString()
      });
      const mandateClaims = validateMandateResolution(
        mandateResolution, descriptor, expectedHost, nowMs
      );

      const operatorAuthority = await identityProvider.authorizeMandateOperator({
        operatorPrincipalId: mandateClaims.operatorPrincipalId,
        stewardRef: descriptor.stewardRef,
        accountabilityRef: descriptor.accountabilityRef,
        leadershipMode: descriptor.leadershipMode
      });
      if (!hasExactKeys(operatorAuthority, [
        "status", "operatorPrincipalId", "accountabilityRef"
      ]) ||
          operatorAuthority.status !== "authorized" ||
          operatorAuthority.operatorPrincipalId !== mandateClaims.operatorPrincipalId ||
          operatorAuthority.accountabilityRef !== descriptor.accountabilityRef) {
        throw new TrustedProjectResolutionError(
          "Mandate issuer/operator is not authorized by the resolved project accountability arrangement.",
          "PROJECT_MANDATE_OPERATOR_UNAUTHORIZED"
        );
      }

      const consentResolution = await consentAuthority.verifyActiveReceipt({
        consentDigest: mandateClaims.operatorConsentDigest,
        mandateDigest: mandateResolution.claimsDigest,
        mandateClaims,
        projectRef: descriptor.projectRef,
        workspaceRef: expectedHost.workspaceRef,
        now: new Date(nowMs).toISOString()
      });
      const consentClaims = validateConsentResolution(
        consentResolution,
        mandateClaims,
        mandateResolution.claimsDigest,
        descriptor,
        expectedHost,
        nowMs
      );

      const revocation = validateRevocationResolution(
        await revocationAuthority.reconcileMandate({
          issuerId: mandateClaims.issuerId,
          mandateId: mandateClaims.mandateId,
          mandateDigest: mandateResolution.claimsDigest,
          now: new Date(nowMs).toISOString()
        })
      );

      const lifecycle = validateLifecycleProjection(
        await projectLifecycleJournal.read(),
        expectedHost.projectRef
      );
      const trustedMandate = Object.freeze({
        claims: mandateClaims,
        mandateDigest: mandateResolution.claimsDigest,
        issuerId: mandateResolution.issuerId,
        signatureVerified: true,
        consentVerified: true,
        revocationState: "healthy"
      });

      return {
        ok: true,
        nowMs,
        descriptor,
        steward,
        accountability,
        mandateClaims,
        trustedMandate,
        consentClaims,
        revocation,
        lifecycle
      };
    } catch (error) {
      const code = error instanceof TrustedProjectResolutionError
        ? error.code
        : "PROJECT_RESOLUTION_PROVIDER_FAILURE";
      return { ok: false, code };
    }
  }

  return Object.freeze({
    async resolve() {
      const context = await loadTrustedContext();
      if (!context.ok) {
        return Object.freeze({ resolved: false, status: "BLOCKED", reason: context.code });
      }
      const lifecycleState = context.lifecycle.state;
      return Object.freeze({
        resolved: true,
        status: "TRUSTED_PROJECT_CONTEXT_RESOLVED",
        project: Object.freeze({
          projectRef: context.descriptor.projectRef,
          leadershipMode: context.descriptor.leadershipMode,
          stewardRef: context.descriptor.stewardRef,
          accountabilityRef: context.descriptor.accountabilityRef,
          lifecycleState,
          lifecycleRevision: context.lifecycle.revision,
          activationEligible: lifecycleState === "configured",
          executionReady: lifecycleState === "active"
        }),
        authority: Object.freeze({
          mandateId: context.mandateClaims.mandateId,
          mandateDigest: context.trustedMandate.mandateDigest,
          issuerId: context.mandateClaims.issuerId,
          state: "active",
          expiresAt: context.mandateClaims.expiresAt
        }),
        identity: Object.freeze({
          stewardPrincipalType: context.steward.principalType,
          accountabilityPrincipalCount: context.accountability.accountablePrincipalRefs.length,
          mandateOperatorPrincipalId: context.mandateClaims.operatorPrincipalId
        }),
        consent: Object.freeze({
          consentId: context.consentClaims.consentId,
          consentBrokerId: context.consentClaims.consentBrokerId,
          sequence: context.consentClaims.sequence
        }),
        revocation: Object.freeze({
          status: context.revocation.status,
          anchorProviderId: context.revocation.anchorProviderId,
          sequence: context.revocation.sequence,
          headEventDigest: context.revocation.headEventDigest
        })
      });
    },

    /**
     * Create a Runtime-only task session. Every operation call re-resolves
     * descriptor, identity, mandate signature/key, consent and mandate
     * revocation/anchor state before the existing ADR-0010 operation evaluator
     * is invoked. No human approval callback or bearer token is introduced.
     */
    async createTaskSession(task) {
      const context = await loadTrustedContext();
      if (!context.ok) return { authorized: false, reason: context.code };
      if (context.lifecycle.state !== "active") {
        return { authorized: false, reason: "PROJECT_NOT_ACTIVE" };
      }

      const initialAuthority = deriveLocalProjectTaskAuthority({
        trustedMandate: context.trustedMandate,
        expectedHost,
        task,
        now: new Date(context.nowMs)
      });
      if (!initialAuthority.authorized) return initialAuthority;

      return Object.freeze({
        authorized: true,
        taskId: task.taskId,
        manifestDigest: task.manifestDigest,
        childDigest: initialAuthority.childDigest,

        async authorizeOperation(request) {
          if (!hasOnlyKeys(request, ["operation"], [
            "relativePath", "executionProfileId", "branchName", "remoteHost"
          ]) || !isText(request.operation, 128)) {
            return { allowed: false, reason: "INVALID_OPERATION_REQUEST" };
          }
          const current = await loadTrustedContext();
          if (!current.ok) return { allowed: false, reason: current.code };
          if (current.lifecycle.state !== "active") {
            return { allowed: false, reason: "PROJECT_NOT_ACTIVE" };
          }

          try {
            const hostPolicy = validateHostPolicy(
              await hostPolicyProvider.readPolicy(),
              expectedHost
            );
            return authorizeLocalProjectOperation({
              childAuthority: initialAuthority,
              trustedMandate: current.trustedMandate,
              hostPolicy,
              expectedTaskId: task.taskId,
              expectedManifestDigest: task.manifestDigest,
              ...request,
              now: new Date(current.nowMs)
            });
          } catch (error) {
            return {
              allowed: false,
              reason: error instanceof TrustedProjectResolutionError
                ? error.code
                : "PROJECT_HOST_POLICY_UNAVAILABLE"
            };
          }
        }
      });
    }
  });
}
