import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createReportSchema, reportEntrySchema } from '../src/validators/reportValidator.js';
import { updateSettingSchema, updateOperatorSchema } from '../src/validators/settingsValidator.js';

describe('Zod Validators', () => {
  describe('reportEntrySchema', () => {
    it('accepts valid category count', () => {
      const parsed = reportEntrySchema.parse({
        category_id: 1,
        count: 15,
        notes: 'Calls made in the morning',
      });
      assert.strictEqual(parsed.count, 15);
      assert.strictEqual(parsed.category_id, 1);
    });

    it('accepts zero count', () => {
      const parsed = reportEntrySchema.parse({
        category_id: 2,
        count: 0,
      });
      assert.strictEqual(parsed.count, 0);
    });

    it('rejects negative count', () => {
      assert.throws(
        () => {
          reportEntrySchema.parse({
            category_id: 1,
            count: -5,
          });
        },
        (err) => {
          assert.ok(
            err.issues.some(
              (i) => i.message.includes('Count cannot be negative') || i.message.includes('noldan kichik')
            )
          );
          return true;
        }
      );
    });

    it('rejects non-integer count', () => {
      assert.throws(
        () => {
          reportEntrySchema.parse({
            category_id: 1,
            count: 3.14,
          });
        },
        (err) => {
          assert.ok(
            err.issues.some(
              (i) => i.message.includes('Count must be an integer') || i.message.includes('butun son')
            )
          );
          return true;
        }
      );
    });
  });

  describe('createReportSchema', () => {
    it('validates correct report payload with default operator name', () => {
      const parsed = createReportSchema.parse({
        report_date: '2026-11-06',
        entries: [
          { category_id: 1, count: 10 },
          { category_id: 2, count: 5 },
        ],
      });
      assert.strictEqual(parsed.operator_name, 'Rahmatillo');
      assert.strictEqual(parsed.report_date, '2026-11-06');
      assert.strictEqual(parsed.entries.length, 2);
    });

    it('rejects invalid date format', () => {
      assert.throws(() => {
        createReportSchema.parse({
          report_date: '06-11-2026',
        });
      });
    });

    it('rejects non-existent calendar dates like Feb 31', () => {
      assert.throws(
        () => {
          createReportSchema.parse({
            report_date: '2026-02-31',
          });
        },
        (err) => {
          assert.ok(
            err.issues.some(
              (i) => i.message.includes('valid calendar date') || i.message.includes('kalendar sanasi')
            )
          );
          return true;
        }
      );
    });
  });

  describe('updateSettingSchema', () => {
    it('accepts valid setting payload', () => {
      const parsed = updateSettingSchema.parse({
        key: 'default_operator_name',
        value: 'Rahmatillo',
        description: 'Updated name',
      });
      assert.strictEqual(parsed.key, 'default_operator_name');
      assert.strictEqual(parsed.value, 'Rahmatillo');
    });

    it('rejects empty key or value', () => {
      assert.throws(() => {
        updateSettingSchema.parse({
          key: '',
          value: 'value',
        });
      });

      assert.throws(() => {
        updateSettingSchema.parse({
          key: 'key',
          value: '',
        });
      });
    });
  });

  describe('updateOperatorSchema', () => {
    it('accepts valid operator name', () => {
      const parsed = updateOperatorSchema.parse({
        operator_name: 'Rahmatillo',
      });
      assert.strictEqual(parsed.operator_name, 'Rahmatillo');
    });

    it('rejects empty operator name', () => {
      assert.throws(() => {
        updateOperatorSchema.parse({
          operator_name: '   ',
        });
      });
    });
  });
});
