export const CHANGE_PROPOSAL_OPERATION_TYPES = Object.freeze([
  "replace_working_state",
  "copy_to_new_version",
  "copy_for_new_role",
  "archive_editing_session",
  "restore_editing_session",
  "archive_cv",
  "restore_cv",
  "publish_revision",
  "withdraw_publication",
]);

export const LIFECYCLE_CHANGE_PROPOSAL_OPERATION_TYPES = Object.freeze(
  CHANGE_PROPOSAL_OPERATION_TYPES.filter((type) => type !== "replace_working_state"),
);

const NEXT_ACTIONS_BY_STATUS = Object.freeze({
  pending: Object.freeze(["apply", "discard"]),
  applied: Object.freeze(["resume", "propose", "finish"]),
  discarded: Object.freeze([]),
  expired: Object.freeze([]),
  invalidated: Object.freeze([]),
});

export const CHANGE_PROPOSAL_STATUSES = Object.freeze(
  Object.keys(NEXT_ACTIONS_BY_STATUS),
);

export function nextChangeProposalActions(status) {
  return [...(NEXT_ACTIONS_BY_STATUS[status] || [])];
}
