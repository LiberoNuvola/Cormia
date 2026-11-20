/**
 * Pure deterministic reducer for Cormia Core Project Lifecycle v0.1.
 *
 * It intentionally knows nothing about mandate authority, task status,
 * payments, Cardano, CRC, AEP settlement or IMMORTAL.
 */

export const PROJECT_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "configured",
  "active",
  "paused",
  "blocked",
  "completed",
  "archived"
]);

export const PROJECT_LIFECYCLE_EVENT_TYPES = Object.freeze([
  "project_created",
  "project_configured",
  "project_activated",
  "project_paused",
  "project_resumed",
  "project_blocked",
  "project_unblocked",
  "project_completed",
  "project_archived",
  "project_metadata_updated"
]);

const STATE_SET = new Set(PROJECT_LIFECYCLE_STATES);

export class ProjectLifecycleTransitionError extends Error {
  constructor(message, code = "PROJECT_LIFECYCLE_TRANSITION_INVALID") {
    super(message);
    this.name = "ProjectLifecycleTransitionError";
    this.code = code;
  }
}

function transitionTarget(eventType, currentState) {
  switch (eventType) {
    case "project_created":
      if (currentState !== null) {
        throw new ProjectLifecycleTransitionError("Project creation is valid only for an empty journal.");
      }
      return "draft";
    case "project_configured":
      if (currentState !== "draft") {
        throw new ProjectLifecycleTransitionError("Only a draft project can become configured.");
      }
      return "configured";
    case "project_activated":
      if (currentState !== "configured") {
        throw new ProjectLifecycleTransitionError("Only a configured project can become active.");
      }
      return "active";
    case "project_paused":
      if (currentState !== "active") {
        throw new ProjectLifecycleTransitionError("Only an active project can be paused.");
      }
      return "paused";
    case "project_resumed":
      if (currentState !== "paused") {
        throw new ProjectLifecycleTransitionError("Only a paused project can be resumed.");
      }
      return "active";
    case "project_blocked":
      if (currentState !== "active") {
        throw new ProjectLifecycleTransitionError("Only an active project can enter blocked state.");
      }
      return "blocked";
    case "project_unblocked":
      if (currentState !== "blocked") {
        throw new ProjectLifecycleTransitionError("Only a blocked project can be unblocked.");
      }
      return "active";
    case "project_completed":
      if (currentState !== "active") {
        throw new ProjectLifecycleTransitionError("Only an active project can be completed.");
      }
      return "completed";
    case "project_archived":
      if (currentState !== "completed") {
        throw new ProjectLifecycleTransitionError("Only a completed project can be archived.");
      }
      return "archived";
    case "project_metadata_updated":
      if (currentState === null || currentState === "archived") {
        throw new ProjectLifecycleTransitionError("Metadata cannot be updated before creation or after archival.");
      }
      return currentState;
    default:
      throw new ProjectLifecycleTransitionError(
        "Unsupported project lifecycle event type.",
        "PROJECT_LIFECYCLE_EVENT_UNSUPPORTED"
      );
  }
}

/**
 * Apply one already-integrity-checked event. The event must state the exact
 * prior and resulting states; a mismatch is rejected rather than repaired.
 */
export function applyProjectLifecycleEvent(currentState, event) {
  if (currentState !== null && !STATE_SET.has(currentState)) {
    throw new ProjectLifecycleTransitionError("Current project state is invalid.");
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new ProjectLifecycleTransitionError("Lifecycle event must be an object.");
  }
  if (event.recordType !== "cormia.core.project-lifecycle-event") {
    throw new ProjectLifecycleTransitionError("Unsupported lifecycle record type.", "PROJECT_LIFECYCLE_RECORD_TYPE_INVALID");
  }
  if (event.fromState !== currentState) {
    throw new ProjectLifecycleTransitionError("Event fromState does not match the current projected state.");
  }
  const target = transitionTarget(event.eventType, currentState);
  if (event.toState !== target) {
    throw new ProjectLifecycleTransitionError("Event toState does not match the deterministic reducer result.");
  }
  return target;
}

export function reduceProjectLifecycle(events, { projectRef } = {}) {
  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array.");
  }
  let state = null;
  let revision = 0;
  let lastEventId = null;
  let lastEventDigest = null;

  for (const event of events) {
    if (projectRef && event?.projectRef !== projectRef) {
      throw new ProjectLifecycleTransitionError("Journal contains an event for a different project.", "PROJECT_LIFECYCLE_PROJECT_MISMATCH");
    }
    state = applyProjectLifecycleEvent(state, event);
    revision += 1;
    lastEventId = event.eventId;
    lastEventDigest = event.recordDigest;
  }

  return {
    projectRef: projectRef ?? events[0]?.projectRef ?? null,
    state,
    revision,
    lastEventId,
    lastEventDigest
  };
}
