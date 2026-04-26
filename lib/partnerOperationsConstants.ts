export const COMPLIANCE_STATUSES = ["pending", "verified", "suspended", "revoked"] as const;
export const PARTNER_ACTIVE_STATUSES = ["onboarding", "operational", "limited", "paused"] as const;
export const SERVICE_READINESS = ["ready", "constrained", "not_accepting"] as const;
export const AVAILABILITY_STATES = ["available", "limited", "paused", "overloaded"] as const;
export const PAUSE_STATES = ["user_initiated", "seasonal", "compliance", "capacity", "platform_hold"] as const;
export const OVERLOAD_SIGNALS = ["none", "soft", "hard"] as const;

export const PROJECT_TYPES = ["residential_rooftop", "commercial_rooftop", "terrace", "ground", "vertical_green"] as const;
export const SOLUTION_TYPES = ["container_garden", "raised_beds", "irrigation", "shade_structure", "edible", "native_mix"] as const;
export const COMPLEXITY_BANDS = ["low", "medium", "high", "custom"] as const;
