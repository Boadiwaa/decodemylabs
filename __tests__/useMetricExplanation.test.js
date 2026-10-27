jest.mock('../src/agents/LabInterpretationAgent', () => ({ __esModule: true, default: { run: jest.fn() } }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/context/ModelContext', () => ({ useModel: jest.fn() }));
jest.mock('../src/services/PatientStorage', () => ({
  getSavedExplanation: jest.fn(),
  saveExplanation: jest.fn(),
}));

import { withSafetyPhrase, buildExplanationCacheKey } from '../src/hooks/useMetricExplanation';

const PHRASE = 'Consult a licensed healthcare provider.';

describe('withSafetyPhrase', () => {
  it('ends the text with exactly one safety phrase', () => {
    expect(withSafetyPhrase('Your value is high.')).toBe(`Your value is high. ${PHRASE}`);
    expect(withSafetyPhrase(`Your value is high. ${PHRASE} Extra note. ${PHRASE}`))
      .toBe(`Your value is high. Extra note. ${PHRASE}`);
  });

  it('returns an empty string for empty input', () => {
    expect(withSafetyPhrase('')).toBe('');
    expect(withSafetyPhrase(undefined)).toBe('');
  });
});

describe('buildExplanationCacheKey', () => {
  const lab = { source_report_id: 'r1', test_name: 'ALT', result_value: '60 U/L' };

  it('changes when the value, trend, or patient context changes', () => {
    const base = buildExplanationCacheKey(lab, null, null);
    expect(buildExplanationCacheKey({ ...lab, result_value: '61 U/L' }, null, null)).not.toBe(base);
    expect(buildExplanationCacheKey(lab, { values: [{ value: 40 }, { value: 60 }] }, null)).not.toBe(base);
    expect(buildExplanationCacheKey(lab, null, { drugHistory: [{ name: 'Metformin' }] })).not.toBe(base);
  });

  it('ignores the order of conditions and medicines', () => {
    const a = { medicalHistory: [{ name: 'Asthma' }, { name: 'Diabetes' }] };
    const b = { medicalHistory: [{ name: 'Diabetes' }, { name: 'Asthma' }] };
    expect(buildExplanationCacheKey(lab, null, a)).toBe(buildExplanationCacheKey(lab, null, b));
  });
});
