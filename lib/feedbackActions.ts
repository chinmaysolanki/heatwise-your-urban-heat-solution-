export const FeedbackActions = {
  VIEW: "view",
  EXPAND_DETAILS: "expand_details",
  COMPARE: "compare",
  SAVE: "save",
  DISMISS: "dismiss",
  MARK_INSTALLED: "mark_installed",
  SHARE: "share",
} as const;

export type FeedbackActionValue =
  (typeof FeedbackActions)[keyof typeof FeedbackActions] | string;

export function normalizeFeedbackAction(action: unknown): FeedbackActionValue | null {
  if (!action) return null;
  const raw = String(action).toLowerCase().trim();
  if (!raw) return null;

  switch (raw) {
    case "view":
    case "viewed":
      return FeedbackActions.VIEW;
    case "expand":
    case "expanded":
    case "expand_details":
      return FeedbackActions.EXPAND_DETAILS;
    case "compare":
      return FeedbackActions.COMPARE;
    case "save":
    case "saved":
      return FeedbackActions.SAVE;
    case "dismiss":
      return FeedbackActions.DISMISS;
    case "installation_requested":
    case "install_request":
    case "mark_installed":
      return FeedbackActions.MARK_INSTALLED;
    case "share":
      return FeedbackActions.SHARE;
    default:
      return raw;
  }
}

export function isViewAction(action: unknown): boolean {
  return normalizeFeedbackAction(action) === FeedbackActions.VIEW;
}

export function isExpandAction(action: unknown): boolean {
  return normalizeFeedbackAction(action) === FeedbackActions.EXPAND_DETAILS;
}

export function isSaveAction(action: unknown): boolean {
  return normalizeFeedbackAction(action) === FeedbackActions.SAVE;
}

export function isInstallAction(action: unknown): boolean {
  return normalizeFeedbackAction(action) === FeedbackActions.MARK_INSTALLED;
}

