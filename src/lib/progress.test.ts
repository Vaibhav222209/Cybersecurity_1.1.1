import { describe, expect, it } from 'vitest';
import { addActivity, emptyProgress, parseProgress } from './progress';

describe('saved progress', () => {
  it('recovers safely from corrupt, absent, and unsupported storage', () => {
    for (const value of [null, '{broken', 'null', '[]', '{"version":2}', 'true']) {
      expect(parseProgress(value, ['passwords'], ['mfa'])).toEqual(emptyProgress());
    }
  });

  it('restores only known progress with valid quiz scores', () => {
    const raw = JSON.stringify({ version: 1,
      completedModules: ['passwords', 'passwords', 'phishing', 'unknown'],
      checkedItems: ['mfa', 'mfa', 'unknown', 4],
      quizScores: { passwords: 3, phishing: 1, unknown: 3, network: 9 },
      activities: [{ id: 'a', text: 'Completed a module', time: 1234 }, { id: 5, text: 'bad', time: -1 }],
    });
    expect(parseProgress(raw, ['passwords', 'phishing', 'network'], ['mfa'])).toEqual({
      version: 1, completedModules: ['passwords'], checkedItems: ['mfa'],
      quizScores: { passwords: 3, phishing: 1 }, activities: [{ id: 'a', text: 'Completed a module', time: 1234 }],
    });
  });

  it('retains only recent activity without mutating the previous state', () => {
    const original = emptyProgress();
    let state = original;
    for (let i = 0; i < 20; i += 1) state = addActivity(state, `Activity ${i}`);
    expect(state.activities).toHaveLength(12);
    expect(state.activities[0].text).toBe('Activity 19');
    expect(new Set(state.activities.map(activity => activity.id)).size).toBe(12);
    expect(original.activities).toHaveLength(0);
    expect(parseProgress(JSON.stringify(state), [], [])).toEqual(state);
  });
});
