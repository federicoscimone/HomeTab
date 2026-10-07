'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { DEMO_TEMPLATE_NAME } from '@/lib/demoImport';

/**
 * @param {object} props
 * @param {object[]|null} props.templates - null mentre si caricano.
 * @param {string|null} props.sampleHref - Estratto conto di esempio (solo nella demo).
 */
export default function StepUpload({ templates: loadedTemplates, sampleHref, onParsed, onError }) {
  const templates = loadedTemplates ?? [];
  const t = useTranslations('import');
  const tCommon = useTranslations('common');
  const [chosenTemplateId, setTemplateId] = useState('');
  // Con un solo template non c'è niente da scegliere: è già selezionato.
  const templateId = chosenTemplateId || (templates.length === 1 ? templates[0]._id : '');
  const [mode, setMode] = useState('file'); // 'file' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const selectedTemplate = templates.find(tpl => tpl._id === templateId);

  const handleParse = async () => {
    if (!templateId) { onError(t('templateRequired')); return; }
    if (mode === 'file' && !file) { onError(t('fileRequired')); return; }
    if (mode === 'paste' && !pasteText.trim()) { onError(t('pasteRequired')); return; }

    setLoading(true);
    onError('');

    const fd = new FormData();
    fd.append('templateId', templateId);
    if (mode === 'file') fd.append('file', file);
    else fd.append('pasteText', pasteText);

    try {
      const res = await fetch('/api/import/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { onError(data.error || t('parseFailed')); }
      else onParsed(data.rows);
    } catch {
      onError(tCommon('networkError'));
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Step 1: Template */}
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body py-4 gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="badge badge-primary badge-sm">{'1'}</span>
            {t('chooseTemplate')}
          </h3>

          {loadedTemplates === null ? (
            <span className="loading loading-spinner loading-sm text-primary" />
          ) : templates.length === 0 ? (
            <div className="alert alert-warning text-sm py-2">
              <span>{t.rich('noTemplates', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {templates.map(tpl => (
                <button
                  key={tpl._id}
                  className={`btn btn-sm justify-start gap-2 ${templateId === tpl._id ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                  onClick={() => setTemplateId(tpl._id)}
                >
                  <span className="badge badge-ghost badge-xs">{tpl.fileType.toUpperCase()}</span>
                  {tpl.name}
                </button>
              ))}
            </div>
          )}

          {sampleHref && (
            <p className="text-sm text-base-content/70">
              {t.rich('sampleHint', {
                template: DEMO_TEMPLATE_NAME,
                link: (chunks) => <a href={sampleHref} className="link link-primary" download>{chunks}</a>,
              })}
            </p>
          )}

          {selectedTemplate && (
            <div className="text-xs text-base-content/50 flex gap-3 flex-wrap mt-1">
              <span>{t('skipRows', { count: selectedTemplate.skipRows })}</span>
              <span>{t('dateFormat', { format: selectedTemplate.dateFormat })}</span>
              {selectedTemplate.fileType === 'csv' && <span>{t('separator', { delimiter: selectedTemplate.delimiter })}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Dati */}
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body py-4 gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="badge badge-primary badge-sm">{'2'}</span>
            {t('provideData')}
          </h3>

          <div className="tabs tabs-box w-fit">
            <button className={`tab tab-sm ${mode === 'file' ? 'tab-active' : ''}`} onClick={() => setMode('file')}>
              {t('uploadFile')}
            </button>
            <button className={`tab tab-sm ${mode === 'paste' ? 'tab-active' : ''}`} onClick={() => setMode('paste')}>
              {t('paste')}
            </button>
          </div>

          {mode === 'file' ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
            >
              <input
                ref={fileRef} type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={e => setFile(e.target.files[0])}
              />
              {file ? (
                <div>
                  <p className="font-medium text-primary">{file.name}</p>
                  <p className="text-xs text-base-content/50 mt-1">{`${(file.size / 1024).toFixed(1)} KB`}</p>
                  <button className="btn btn-ghost btn-xs mt-2" onClick={e => { e.stopPropagation(); setFile(null); }}>
                    {t('remove')}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">{'📂'}</p>
                  <p className="font-medium">{t('dropHint')}</p>
                  <p className="text-xs text-base-content/50 mt-1">{'.xlsx, .xls, .csv'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-base-content/60">{t('pasteHint')}</p>
              <textarea
                className="textarea textarea-bordered font-mono text-xs"
                rows={8}
                placeholder={t('pastePlaceholder')}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <p className="text-xs text-base-content/40">
                {pasteText ? t('rowsDetected', { count: pasteText.split('\n').filter(l => l.trim()).length }) : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleParse}
        disabled={loading || !templateId || (mode === 'file' ? !file : !pasteText.trim())}
      >
        {loading && <span className="loading loading-spinner loading-sm" />}
        {loading ? t('analyzing') : t('analyzeAndContinue')}
      </button>
    </div>
  );
}
