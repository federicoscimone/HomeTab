'use client';

import { useState, useRef } from 'react';

export default function StepUpload({ templates, onParsed, onError }) {
  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState('file'); // 'file' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const selectedTemplate = templates.find(t => t._id === templateId);

  const handleParse = async () => {
    if (!templateId) { onError('Seleziona un template'); return; }
    if (mode === 'file' && !file) { onError('Seleziona un file'); return; }
    if (mode === 'paste' && !pasteText.trim()) { onError('Incolla i dati'); return; }

    setLoading(true);
    onError('');

    const fd = new FormData();
    fd.append('templateId', templateId);
    if (mode === 'file') fd.append('file', file);
    else fd.append('pasteText', pasteText);

    try {
      const res = await fetch('/api/import/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { onError(data.error || 'Errore parsing'); }
      else onParsed(data.rows);
    } catch {
      onError('Errore di rete');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Step 1: Template */}
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body py-4 gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="badge badge-primary badge-sm">1</span>
            Seleziona il template
          </h3>

          {templates.length === 0 ? (
            <div className="alert alert-warning text-sm py-2">
              <span>Nessun template configurato. Vai in <strong>Impostazioni → Template Import</strong> per crearne uno.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {templates.map(t => (
                <button
                  key={t._id}
                  className={`btn btn-sm justify-start gap-2 ${templateId === t._id ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                  onClick={() => setTemplateId(t._id)}
                >
                  <span className="badge badge-ghost badge-xs">{t.fileType.toUpperCase()}</span>
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {selectedTemplate && (
            <div className="text-xs text-base-content/50 flex gap-3 flex-wrap mt-1">
              <span>Salta {selectedTemplate.skipRows} righe</span>
              <span>Data: {selectedTemplate.dateFormat}</span>
              {selectedTemplate.fileType === 'csv' && <span>Sep: &quot;{selectedTemplate.delimiter}&quot;</span>}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Dati */}
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body py-4 gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="badge badge-primary badge-sm">2</span>
            Fornisci i dati
          </h3>

          <div className="tabs tabs-boxed w-fit">
            <button className={`tab tab-sm ${mode === 'file' ? 'tab-active' : ''}`} onClick={() => setMode('file')}>
              Carica file
            </button>
            <button className={`tab tab-sm ${mode === 'paste' ? 'tab-active' : ''}`} onClick={() => setMode('paste')}>
              Copia-incolla
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
                  <p className="text-xs text-base-content/50 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button className="btn btn-ghost btn-xs mt-2" onClick={e => { e.stopPropagation(); setFile(null); }}>
                    Rimuovi
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📂</p>
                  <p className="font-medium">Trascina il file o clicca per sceglierlo</p>
                  <p className="text-xs text-base-content/50 mt-1">.xlsx, .xls, .csv</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-base-content/60">
                Copia le righe direttamente da Excel e incollale qui sotto (Ctrl+V).
                Le colonne devono corrispondere alla mappatura del template selezionato.
              </p>
              <textarea
                className="textarea textarea-bordered font-mono text-xs"
                rows={8}
                placeholder="Incolla qui le righe copiate da Excel…"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <p className="text-xs text-base-content/40">
                {pasteText ? `${pasteText.split('\n').filter(l => l.trim()).length} righe rilevate` : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        className={`btn btn-primary ${loading ? 'loading' : ''}`}
        onClick={handleParse}
        disabled={loading || !templateId || (mode === 'file' ? !file : !pasteText.trim())}
      >
        {loading ? 'Analisi in corso…' : 'Analizza e prosegui →'}
      </button>
    </div>
  );
}
