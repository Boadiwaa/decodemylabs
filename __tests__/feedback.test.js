jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-device', () => ({ modelName: 'Test phone' }));

import {
  getExplanationRatings, saveExplanationRating, summarizeExplanationRatings,
} from '../src/services/PatientStorage';
import { buildFeedbackMessage, APP_VERSION } from '../src/services/Feedback';

const device = { os: 'Android', osVersion: '36', model: 'Pixel 9a' };

describe('explanation ratings', () => {
  it('saves, changes and clears an answer per result', async () => {
    await saveExplanationRating('u1', 'ALT|2025-10-16|40 U/L', { helpful: true, source: 'gemma' });
    await saveExplanationRating('u1', 'AST|2025-10-16|30 U/L', { helpful: false, source: 'standard' });
    await saveExplanationRating('u1', 'ALT|2025-10-16|40 U/L', { helpful: false, source: 'gemma' });
    let all = await getExplanationRatings('u1');
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['ALT|2025-10-16|40 U/L'].helpful).toBe(false);

    await saveExplanationRating('u1', 'AST|2025-10-16|30 U/L', null);
    all = await getExplanationRatings('u1');
    expect(Object.keys(all)).toEqual(['ALT|2025-10-16|40 U/L']);
    expect(await getExplanationRatings('someone-else')).toEqual({});
  });

  it('counts answers by explanation source', () => {
    expect(summarizeExplanationRatings({
      a: { helpful: true, source: 'gemma' },
      b: { helpful: true, source: 'gemma' },
      c: { helpful: false, source: 'gemma' },
      d: { helpful: true, source: 'standard' },
    })).toEqual({ gemma: { helpful: 2, notHelpful: 1 }, standard: { helpful: 1, notHelpful: 0 } });
  });
});

describe('buildFeedbackMessage', () => {
  it('includes the rating, topic, comment, app details and rating counts', () => {
    const { subject, body } = buildFeedbackMessage({
      rating: 4,
      topic: 'explanation',
      comment: '  The liver section used words I did not know.  ',
      ratings: { gemma: { helpful: 2, notHelpful: 1 }, standard: { helpful: 0, notHelpful: 0 } },
    }, device);
    expect(subject).toBe('Decode My Labs feedback: An explanation was unclear');
    expect(body).toContain('Rating: 4 out of 5');
    expect(body).toContain('The liver section used words I did not know.');
    expect(body).toContain(`Decode My Labs ${APP_VERSION} · Android 36 · Pixel 9a`);
    expect(body).toContain('Gemma 2 of 3, standard 0 of 0');
  });

  it('says where Gemma ran when it is loaded', () => {
    expect(buildFeedbackMessage({ aiBackend: 'gpu' }, device).body).toContain('Pixel 9a · Gemma on GPU');
    expect(buildFeedbackMessage({ aiBackend: null }, device).body).not.toContain('Gemma on');
  });

  it('handles a message with nothing chosen', () => {
    const { subject, body } = buildFeedbackMessage({}, device);
    expect(subject).toBe('Decode My Labs feedback: General');
    expect(body).toContain('Rating: not given');
    expect(body).toContain('(no comment)');
    expect(body).not.toContain('Explanations rated');
  });
});
