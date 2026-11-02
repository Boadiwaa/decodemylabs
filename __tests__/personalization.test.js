import { buildPersonalizationInsights, getAbnormalDirection } from '../src/domain/personalization';

const SAFETY_PHRASE = 'Consult a licensed healthcare provider.';

describe('getAbnormalDirection', () => {
  it('reports low, high, and normal values', () => {
    expect(getAbnormalDirection('Potassium', 2.8, 'mmol/L')).toBe('low');
    expect(getAbnormalDirection('Potassium', 5.5, 'mmol/L')).toBe('high');
    expect(getAbnormalDirection('Potassium', 4.0, 'mmol/L')).toBe('normal');
  });

  it('is unknown for non-numeric values', () => {
    expect(getAbnormalDirection('Potassium', NaN, 'mmol/L')).toBe('unknown');
  });
});

describe('buildPersonalizationInsights', () => {
  const lowMagnesium = { test_name: 'Magnesium', numeric_value: 1.5, unit: 'mg/dL', result_value: '1.5 mg/dL' };

  it('adds PPI context for low magnesium when the patient takes omeprazole', () => {
    const insight = buildPersonalizationInsights({
      lab: lowMagnesium,
      patientContext: { drugHistory: [{ name: 'Omeprazole 20mg' }] },
    });

    expect(insight).not.toBeNull();
    expect(insight.id).toBe('ppi-low-magnesium');
    expect(insight.medication).toBe('Omeprazole 20mg');
    expect(insight.patientNotes.en.endsWith(SAFETY_PHRASE)).toBe(true);
  });

  it('avoids diagnosis language in the model prompt context', () => {
    const insight = buildPersonalizationInsights({
      lab: lowMagnesium,
      patientContext: { drugHistory: [{ name: 'Omeprazole' }] },
    });
    expect(insight.promptContext).toMatch(/not as a diagnosis/);
  });

  it('returns null without a relevant medication', () => {
    expect(buildPersonalizationInsights({
      lab: lowMagnesium,
      patientContext: { drugHistory: [{ name: 'Metformin' }] },
    })).toBeNull();
  });

  it('returns null when magnesium is normal', () => {
    expect(buildPersonalizationInsights({
      lab: { ...lowMagnesium, numeric_value: 2.1, result_value: '2.1 mg/dL' },
      patientContext: { drugHistory: [{ name: 'Omeprazole' }] },
    })).toBeNull();
  });

  it('returns null without any medication history', () => {
    expect(buildPersonalizationInsights({ lab: lowMagnesium, patientContext: {} })).toBeNull();
  });
});
