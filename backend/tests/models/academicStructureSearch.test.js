import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({ query: vi.fn() }));
vi.mock('../../src/models/AccessScope.js', () => ({
  resolveScopedSite: vi.fn(),
  scopedWhere: vi.fn(),
}));

import { query } from '../../src/config/database.js';
import { resolveScopedSite, scopedWhere } from '../../src/models/AccessScope.js';
import { AcademicStructure } from '../../src/models/AcademicStructure.js';

describe('AcademicStructure.listAnnualClasses search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveScopedSite.mockResolvedValue('site-1');
    query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT id, libelle FROM annees_scolaires')) {
        return { rows: [{ id: 'year-1', libelle: '2026-2027' }] };
      }
      if (sql === 'SELECT type FROM etablissement WHERE singleton = true') {
        return { rows: [{ type: 'primaire' }] };
      }
      return { rows: [] };
    });
  });

  it('searches a primary level code and its display label within the permitted site', async () => {
    scopedWhere.mockReturnValue({
      sql: ' AND ca.site_id = ANY($3::uuid[])',
      params: [['site-1']],
    });

    await AcademicStructure.listAnnualClasses({ allSites: false, siteIds: ['site-1'] }, 'CI');

    const [sql, params] = query.mock.calls.at(-1);
    expect(sql).toContain('ca.site_id = ANY($3::uuid[])');
    expect(sql).toContain('ca.code_affichage ILIKE $4');
    expect(sql).toContain('n.code ILIKE $4');
    expect(sql).toContain('n.libelle ILIKE $4');
    expect(params).toEqual(['year-1', ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], ['site-1'], '%CI%']);
  });

  it('uses the correct search parameter when the account can see every site', async () => {
    scopedWhere.mockReturnValue({ sql: '', params: [] });

    await AcademicStructure.listAnnualClasses({ allSites: true, siteIds: [] }, 'ci');

    const [sql, params] = query.mock.calls.at(-1);
    expect(sql).toContain('ca.code_affichage ILIKE $3');
    expect(sql).toContain('n.code ILIKE $3');
    expect(params).toEqual(['year-1', ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], '%ci%']);
  });
});
