import { calculateLeadScore, ScoringInput } from './scoring.rules';

const base: ScoringInput = {
  fit: { employeeCount: null, industry: null, revenue: null },
  engagement: { opens: 0, clicks: 0 },
  recencyDays: null,
  profile: { hasEmail: false, hasPhone: false, hasWebsite: false },
};

describe('calculateLeadScore', () => {
  it('scores an empty lead at 0', () => {
    expect(calculateLeadScore(base).total).toBe(0);
  });

  describe('fit', () => {
    it('awards +20 for 50–500 employees, 0 outside', () => {
      expect(calculateLeadScore({ ...base, fit: { ...base.fit, employeeCount: 50 } }).fit).toBe(20);
      expect(calculateLeadScore({ ...base, fit: { ...base.fit, employeeCount: 500 } }).fit).toBe(
        20,
      );
      expect(calculateLeadScore({ ...base, fit: { ...base.fit, employeeCount: 49 } }).fit).toBe(0);
      expect(calculateLeadScore({ ...base, fit: { ...base.fit, employeeCount: 501 } }).fit).toBe(0);
    });

    it('awards +15 for a target industry (case-insensitive)', () => {
      for (const industry of ['SaaS', 'saas', 'E-Commerce', 'FinTech']) {
        expect(calculateLeadScore({ ...base, fit: { ...base.fit, industry } }).fit).toBe(15);
      }
      expect(
        calculateLeadScore({ ...base, fit: { ...base.fit, industry: 'Manufacturing' } }).fit,
      ).toBe(0);
    });

    it('awards +10 only for revenue strictly above 1M', () => {
      expect(calculateLeadScore({ ...base, fit: { ...base.fit, revenue: 1_000_000 } }).fit).toBe(0);
      expect(calculateLeadScore({ ...base, fit: { ...base.fit, revenue: 1_000_001 } }).fit).toBe(
        10,
      );
    });
  });

  describe('engagement (capped)', () => {
    it('caps opens at 10 and clicks at 15', () => {
      const r = calculateLeadScore({ ...base, engagement: { opens: 20, clicks: 20 } });
      expect(r.engagement).toBe(25); // min(40,10) + min(100,15)
    });
    it('scales below the cap', () => {
      expect(calculateLeadScore({ ...base, engagement: { opens: 3, clicks: 2 } }).engagement).toBe(
        16,
      );
    });
  });

  describe('recency', () => {
    it('awards +15 under 7 days, +5 under 30, else 0', () => {
      expect(calculateLeadScore({ ...base, recencyDays: 3 }).recency).toBe(15);
      expect(calculateLeadScore({ ...base, recencyDays: 20 }).recency).toBe(5);
      expect(calculateLeadScore({ ...base, recencyDays: 40 }).recency).toBe(0);
      expect(calculateLeadScore({ ...base, recencyDays: null }).recency).toBe(0);
    });
  });

  describe('profile', () => {
    it('awards +10 only when email, phone and website all present', () => {
      expect(
        calculateLeadScore({
          ...base,
          profile: { hasEmail: true, hasPhone: true, hasWebsite: true },
        }).profile,
      ).toBe(10);
      expect(
        calculateLeadScore({
          ...base,
          profile: { hasEmail: true, hasPhone: false, hasWebsite: true },
        }).profile,
      ).toBe(0);
    });
  });

  it('never exceeds 100 and reaches the auto-convert threshold on a strong lead', () => {
    const strong: ScoringInput = {
      fit: { employeeCount: 120, industry: 'SaaS', revenue: 5_000_000 },
      engagement: { opens: 10, clicks: 5 },
      recencyDays: 1,
      profile: { hasEmail: true, hasPhone: true, hasWebsite: true },
    };
    const r = calculateLeadScore(strong);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.total).toBeGreaterThanOrEqual(80);
  });
});
