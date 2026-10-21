export interface FlagRule {
  key: string;
  enabled: boolean;
  targetAll: boolean;
  targets: readonly string[];
}

/**
 * The one evaluation rule shared by the API, flag-client and tests:
 * `enabled && (targetAll || targets.has(userId))`. A missing flag is `false`.
 */
export function evaluate(flag: FlagRule | undefined, userId: string): boolean {
  if (!flag?.enabled) return false;
  return flag.targetAll || flag.targets.includes(userId);
}
