import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMPORT_SOURCE,
  buildImportTrackingFields,
  buildMongoImportExtras,
  buildPendingImagesFields,
} from '../../core/mongoImportExtras';

const ISO = '2026-06-25T12:00:00.000Z';

describe('buildImportTrackingFields (demanda 1)', () => {
  it('usa a origem default e o timestamp injetado', () => {
    expect(buildImportTrackingFields({ importedAt: ISO })).toEqual({
      import_source: DEFAULT_IMPORT_SOURCE,
      imported_at: ISO,
    });
  });

  it('respeita source e jobId quando informados', () => {
    expect(
      buildImportTrackingFields({ importedAt: ISO, source: 'ml', jobId: ' job-1 ' })
    ).toEqual({
      import_source: 'ml',
      imported_at: ISO,
      import_job_id: 'job-1',
    });
  });

  it('omite import_job_id quando vazio', () => {
    const fields = buildImportTrackingFields({ importedAt: ISO, jobId: '   ' });
    expect(fields).not.toHaveProperty('import_job_id');
  });

  it('exige importedAt (clock injetado, build deterministico)', () => {
    // @ts-expect-error importedAt obrigatorio
    expect(() => buildImportTrackingFields({})).toThrow(/importedAt/);
  });
});

describe('buildPendingImagesFields (demanda 2)', () => {
  it('images fica vazio e as urls vao para pending', () => {
    const fields = buildPendingImagesFields({
      imageUrls: ['https://x/a.jpg', 'https://x/b.jpg'],
    });
    expect(fields.images).toEqual([]);
    expect(fields.image_count).toBe(0);
    expect(fields.pending_image_urls).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
    expect(fields.images_pending).toBe(true);
    expect(fields.images_pending_count).toBe(2);
  });

  it('descarta vazios/nulos e deduplica preservando ordem', () => {
    const fields = buildPendingImagesFields({
      imageUrls: [' https://x/a.jpg ', '', null, 'https://x/a.jpg', 'https://x/b.jpg'],
    });
    expect(fields.pending_image_urls).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
    expect(fields.images_pending_count).toBe(2);
  });

  it('sem urls: nao pendente, sem campos opcionais', () => {
    const fields = buildPendingImagesFields({ imageUrls: [], pendingAt: ISO, source: 'planilha' });
    expect(fields.images_pending).toBe(false);
    expect(fields.images_pending_count).toBe(0);
    expect(fields).not.toHaveProperty('images_pending_at');
    expect(fields).not.toHaveProperty('images_pending_source');
  });

  it('inclui pendingAt e source quando ha urls', () => {
    const fields = buildPendingImagesFields({
      imageUrls: ['https://x/a.jpg'],
      pendingAt: ISO,
      source: 'planilha',
    });
    expect(fields.images_pending_at).toBe(ISO);
    expect(fields.images_pending_source).toBe('planilha');
  });

  it('entrada vazia (sem argumento) e segura', () => {
    expect(buildPendingImagesFields().images_pending).toBe(false);
  });
});

describe('buildMongoImportExtras (composicao)', () => {
  it('junta rastreio + imagens pendentes', () => {
    const extras = buildMongoImportExtras({
      tracking: { importedAt: ISO, jobId: 'job-9' },
      images: { imageUrls: ['https://x/a.jpg'], pendingAt: ISO, source: 'planilha' },
    });
    expect(extras).toEqual({
      import_source: DEFAULT_IMPORT_SOURCE,
      imported_at: ISO,
      import_job_id: 'job-9',
      images: [],
      image_count: 0,
      pending_image_urls: ['https://x/a.jpg'],
      images_pending: true,
      images_pending_count: 1,
      images_pending_at: ISO,
      images_pending_source: 'planilha',
    });
  });
});
