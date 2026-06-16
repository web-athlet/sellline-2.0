import { countFilledFields, normalizeFields } from './enrichment.types';

describe('normalizeFields', () => {
  it('coerces a well-formed object', () => {
    const f = normalizeFields({
      branche: '  SaaS  ',
      mitarbeiterzahl: 120,
      jahresumsatz: 5_000_000,
      headquarter: 'Berlin',
      techStack: ['Node', 'React'],
      socialProfiles: { linkedin: 'x', xing: '', twitter: 'y' },
    });
    expect(f).toMatchObject({
      branche: 'SaaS',
      mitarbeiterzahl: 120,
      headquarter: 'Berlin',
      techStack: ['Node', 'React'],
    });
    expect(f.socialProfiles.linkedin).toBe('x');
    expect(f.socialProfiles.xing).toBeNull();
  });

  it('nulls out wrong-typed and non-finite values', () => {
    const f = normalizeFields({
      branche: 42,
      mitarbeiterzahl: Number.POSITIVE_INFINITY,
      jahresumsatz: 'lots',
      headquarter: '',
      techStack: 'not-an-array',
      socialProfiles: null,
    });
    expect(f.branche).toBeNull();
    expect(f.mitarbeiterzahl).toBeNull();
    expect(f.jahresumsatz).toBeNull();
    expect(f.headquarter).toBeNull();
    expect(f.techStack).toEqual([]);
    expect(f.socialProfiles).toEqual({ linkedin: null, xing: null, twitter: null });
  });

  it('filters non-string entries out of techStack', () => {
    expect(normalizeFields({ techStack: ['Node', 5, null, 'Go'] }).techStack).toEqual([
      'Node',
      'Go',
    ]);
  });

  it('handles null / empty input', () => {
    expect(normalizeFields(null).techStack).toEqual([]);
    expect(countFilledFields(normalizeFields({}))).toBe(0);
  });

  it('counts only filled fields', () => {
    expect(
      countFilledFields(
        normalizeFields({
          branche: 'SaaS',
          techStack: ['Node'],
          socialProfiles: { linkedin: 'x' },
        }),
      ),
    ).toBe(3);
  });
});
