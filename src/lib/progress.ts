export interface Activity {
  id: string;
  text: string;
  time: number;
}

export interface Progress {
  version: 1;
  completedModules: string[];
  checkedItems: string[];
  quizScores: Record<string, number>;
  activities: Activity[];
}

export const STORAGE_KEY = 'cipher-workspace-v1';

export function emptyProgress(): Progress {
  return { version: 1, completedModules: [], checkedItems: [], quizScores: {}, activities: [] };
}

export function parseProgress(raw: string | null, moduleIds: readonly string[], itemIds: readonly string[]): Progress {
  const result = emptyProgress();
  if (!raw) return result;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) return result;
    const data = parsed as Record<string, unknown>;
    const knownIds = (value: unknown, allowed: readonly string[]) => Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.includes(id)))] : [];
    result.completedModules = knownIds(data.completedModules, moduleIds);
    result.checkedItems = knownIds(data.checkedItems, itemIds);
    if (data.quizScores && typeof data.quizScores === 'object' && !Array.isArray(data.quizScores)) {
      for (const [id, value] of Object.entries(data.quizScores)) {
        if (moduleIds.includes(id) && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
          result.quizScores[id] = value;
        }
      }
    }
    // A module is complete only when a passing quiz result was recorded.
    result.completedModules = result.completedModules.filter(id => (result.quizScores[id] ?? 0) >= 2);
    if (Array.isArray(data.activities)) {
      result.activities = data.activities.filter((entry): entry is Activity => {
        if (!entry || typeof entry !== 'object') return false;
        const { id, text, time } = entry as Record<string, unknown>;
        return typeof id === 'string' && id.length <= 100 && typeof text === 'string' && text.length <= 160
          && typeof time === 'number' && Number.isFinite(time) && time >= 0 && time <= Date.now() + 300_000;
      }).slice(0, 12);
    }
    return result;
  } catch {
    return result;
  }
}

export function addActivity(progress: Progress, text: string): Progress {
  return {
    ...progress,
    activities: [{ id: crypto.randomUUID(), text: text.slice(0, 160), time: Date.now() }, ...progress.activities].slice(0, 12),
  };
}
