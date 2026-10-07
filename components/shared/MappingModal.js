'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/** Parte tra parentesi di un'etichetta, es. "(opzionale)". */
const muted = (chunks) => <span className="font-normal opacity-60">{chunks}</span>;

/**
 * Modal for creating a new keyword → category mapping.
 *
 * Props:
 *  - modal        : { keyword, categoryId, subCategory1Id, priority, caseSensitive }
 *  - onChange(patch): update modal state
 *  - onConfirm()  : async handler that saves and applies the mapping; called on "Save and apply"
 *  - onClose()    : closes the modal without saving
 *  - level1       : category[] where level === 1
 *  - level2of(id) : fn → category[] where level === 2 and parentId === id
 *  - error        : string | '' — validation/server error to display
 */
export default function MappingModal({ modal, onChange, onConfirm, onClose, level1, level2of, error }) {
  const t = useTranslations('mapping');
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm();
    setSaving(false);
  };

  const subCategories = modal.categoryId ? level2of(modal.categoryId) : [];

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-base mb-1">{t('title')}</h3>
        <p className="text-xs text-base-content/50 mb-4">{t('intro')}</p>

        <div className="flex flex-col gap-3">
          {/* Keyword */}
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs font-medium">{t('keyword')}</span></div>
            <input
              type="text"
              className="input input-bordered input-sm"
              placeholder={t('keywordPlaceholder')}
              value={modal.keyword}
              onChange={e => onChange({ keyword: e.target.value })}
              autoFocus
            />
          </label>

          {/* Categoria */}
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs font-medium">{tCommon('category')}</span></div>
            <select
              className="select select-bordered select-sm"
              value={modal.categoryId}
              onChange={e => onChange({ categoryId: e.target.value, subCategory1Id: '' })}
            >
              <option value="">{t('chooseCategory')}</option>
              {level1.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </label>

          {/* Sotto-categoria */}
          {subCategories.length > 0 && (
            <label className="form-control">
              <div className="label py-0">
                <span className="label-text text-xs font-medium">{t.rich('subCategory', { muted })}</span>
              </div>
              <select
                className="select select-bordered select-sm"
                value={modal.subCategory1Id}
                onChange={e => onChange({ subCategory1Id: e.target.value })}
              >
                <option value="">{tCommon('none')}</option>
                {subCategories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
          )}

          {/* Priorità + Case sensitive */}
          <div className="flex gap-3 items-end">
            <label className="form-control flex-1">
              <div className="label py-0"><span className="label-text text-xs font-medium">{t('priority')}</span></div>
              <input
                type="number"
                className="input input-bordered input-sm"
                min={0}
                value={modal.priority}
                onChange={e => onChange({ priority: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer pb-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={modal.caseSensitive}
                onChange={e => onChange({ caseSensitive: e.target.checked })}
              />
              {t('caseSensitive')}
            </label>
          </div>

          {error && (
            <div className="alert alert-error text-xs py-2">{error}</div>
          )}
        </div>

        <div className="modal-action mt-4">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{tCommon('cancel')}</button>
          <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={saving}>
            {saving && <span className="loading loading-spinner loading-xs" />}
            {saving ? tCommon('saving') : t('saveAndApply')}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
