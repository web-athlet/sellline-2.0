import { describe, it, expect } from 'vitest';
import {
  ENRICHMENT_LABEL,
  FIELD_TYPE_LABEL,
  leadsKeys,
  formsKeys,
  type EnrichmentStatus,
  type FormField,
} from './leads-api';

describe('leads-api', () => {
  describe('ENRICHMENT_LABEL', () => {
    const statuses: EnrichmentStatus[] = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'];
    it.each(statuses)('has a label for %s', (status) => {
      expect(ENRICHMENT_LABEL[status]).toBeTruthy();
    });

    it('PENDING label is "Ausstehend"', () => {
      expect(ENRICHMENT_LABEL.PENDING).toBe('Ausstehend');
    });

    it('PROCESSING label is "Wird angereichert..."', () => {
      expect(ENRICHMENT_LABEL.PROCESSING).toBe('Wird angereichert...');
    });

    it('DONE label is "Angereichert"', () => {
      expect(ENRICHMENT_LABEL.DONE).toBe('Angereichert');
    });

    it('FAILED label is "Fehlgeschlagen"', () => {
      expect(ENRICHMENT_LABEL.FAILED).toBe('Fehlgeschlagen');
    });
  });

  describe('FIELD_TYPE_LABEL', () => {
    const types: FormField['type'][] = [
      'text',
      'email',
      'tel',
      'textarea',
      'number',
      'dropdown',
      'checkbox',
      'radio',
      'date',
      'file',
    ];
    it.each(types)('has a label for %s', (type) => {
      expect(FIELD_TYPE_LABEL[type]).toBeTruthy();
    });
  });

  describe('leadsKeys', () => {
    it('all() returns stable key', () => {
      expect(leadsKeys.all()).toEqual(['leads']);
    });

    it('list() includes filters', () => {
      const key = leadsKeys.list({ enrichmentStatus: 'DONE' });
      expect(key).toEqual(['leads', 'list', { enrichmentStatus: 'DONE' }]);
    });

    it('detail() includes id', () => {
      expect(leadsKeys.detail('abc')).toEqual(['leads', 'detail', 'abc']);
    });
  });

  describe('formsKeys', () => {
    it('all() returns stable key', () => {
      expect(formsKeys.all()).toEqual(['forms']);
    });

    it('list() is stable', () => {
      expect(formsKeys.list()).toEqual(['forms', 'list']);
    });

    it('detail() includes id', () => {
      expect(formsKeys.detail('form-1')).toEqual(['forms', 'detail', 'form-1']);
    });

    it('embed() includes id', () => {
      expect(formsKeys.embed('form-1')).toEqual(['forms', 'embed', 'form-1']);
    });
  });
});
