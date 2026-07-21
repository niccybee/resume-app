const NEXT_ACTIONS_BY_STATUS = Object.freeze({
  pending: Object.freeze(["apply", "discard"]),
  applied: Object.freeze(["resume", "propose", "finish"]),
  discarded: Object.freeze([]),
  expired: Object.freeze([]),
  invalidated: Object.freeze([]),
});

export function nextChangeProposalActions(status) {
  return [...(NEXT_ACTIONS_BY_STATUS[status] || [])];
}
