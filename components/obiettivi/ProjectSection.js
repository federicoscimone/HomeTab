'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

async function save(goalId, body) {
  const res = await fetch(`/api/obiettivi/${goalId}/progetto`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '');
}

const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

/**
 * L'obiettivo come progetto: voci con budget, preventivo e speso, e le cose da fare.
 *
 * @param {{ goalId: string, project: object, canManage: boolean, canEdit: boolean, onSaved: () => void }} props -
 *   canManage: può cambiare le voci; canEdit: può spuntare e aggiungere cose da fare.
 */
export default function ProjectSection({ goalId, project, canManage, canEdit, onSaved }) {
  const t = useTranslations('project');
  const { fmtFull, fmtRound, fmtDate } = useFormat();
  const [editing, setEditing] = useState(null); // righe in modifica, o null
  const [newTask, setNewTask] = useState({ text: '', due: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const run = async (body) => {
    setBusy(true);
    setError(null);
    try {
      await save(goalId, body);
      onSaved();
      return true;
    } catch (err) {
      setError(err.message || t('failed'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => setEditing(project.rows.map((r) => ({ id: r.id, name: r.name, budget: String(r.budget), quote: r.quote == null ? '' : String(r.quote) })));
  const saveItems = async () => {
    const items = editing.filter((r) => r.name.trim()).map((r) => ({ id: r.id, name: r.name, budget: num(r.budget) ?? 0, quote: num(r.quote) }));
    if (await run({ items })) setEditing(null);
  };
  const setRow = (i, field, value) => setEditing((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  const tasksPayload = (tasks) => tasks.map((x) => ({ id: x.id, text: x.text, due: x.due ?? null, done: x.done }));
  const toggle = (task) => run({ tasks: tasksPayload(project.tasks.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x))) });
  const removeTask = (task) => run({ tasks: tasksPayload(project.tasks.filter((x) => x.id !== task.id)) });
  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.text.trim()) return;
    if (await run({ tasks: [...tasksPayload(project.tasks), { text: newTask.text, due: newTask.due || null, done: false }] })) setNewTask({ text: '', due: '' });
  };

  const { rows, totals, unassigned, overCount, tasks, tasksSummary } = project;

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body p-4 gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-base-content/60">{t('title')}</h3>
            <p className="text-xs text-base-content/40">{t('intro')}</p>
          </div>
          {canManage && !editing && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={startEdit}>{rows.length ? t('editItems') : t('addItems')}</button>
          )}
        </div>
        {error && <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>}
        {overCount > 0 && <div className="alert alert-warning py-2 text-sm"><span>{t('overAlert', { n: overCount })}</span></div>}

        {editing ? (
          <div className="flex flex-col gap-2">
            {editing.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 flex-1 min-w-40">
                  <span className="text-xs">{t('cols.item')}</span>
                  <input className="input input-sm" maxLength={100} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 w-28">
                  <span className="text-xs">{t('cols.budget')}</span>
                  <input className="input input-sm" inputMode="decimal" value={r.budget} onChange={(e) => setRow(i, 'budget', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 w-28">
                  <span className="text-xs">{t('cols.quote')}</span>
                  <input className="input input-sm" inputMode="decimal" value={r.quote} onChange={(e) => setRow(i, 'quote', e.target.value)} />
                </label>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing((rows2) => rows2.filter((_, j) => j !== i))}>{t('remove')}</button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing((rows2) => [...rows2, { name: '', budget: '', quote: '' }])}>{t('addRow')}</button>
              <span className="flex-1" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveItems}>{t('save')}</button>
            </div>
            <p className="text-xs text-base-content/50">{t('itemsHint')}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-base-content/40">{t('noItems')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t('cols.item')}</th>
                  <th className="text-right">{t('cols.budget')}</th>
                  <th className="text-right">{t('cols.quote')}</th>
                  <th className="text-right">{t('cols.spent')}</th>
                  <th className="text-right">{t('cols.remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.over ? 'bg-error/10' : ''}>
                    <td>
                      <div>{r.name}</div>
                      {r.quoteOver && <div className="text-xs text-warning">{t('quoteOver')}</div>}
                    </td>
                    <td className="text-right tabular-nums">{fmtFull(r.budget)}</td>
                    <td className="text-right tabular-nums">{r.quote != null ? fmtFull(r.quote) : '—'}</td>
                    <td className="text-right tabular-nums">{fmtFull(r.spent)}</td>
                    <td className={`text-right tabular-nums ${r.remaining < 0 ? 'text-error' : ''}`}>{fmtFull(r.remaining)}</td>
                  </tr>
                ))}
                {unassigned > 0 && (
                  <tr>
                    <td className="text-base-content/60">{t('unassigned')}</td>
                    <td /><td />
                    <td className="text-right tabular-nums">{fmtFull(unassigned)}</td>
                    <td />
                  </tr>
                )}
                <tr className="font-semibold">
                  <td>{t('total')}</td>
                  <td className="text-right tabular-nums">{fmtRound(totals.budget)}</td>
                  <td className="text-right tabular-nums">{totals.quote ? fmtRound(totals.quote) : '—'}</td>
                  <td className="text-right tabular-nums">{fmtRound(totals.spent)}</td>
                  <td className="text-right tabular-nums">{fmtRound(totals.budget - totals.spent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="divider my-0" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-base-content/60">{t('tasksTitle')}</h4>
            {tasksSummary.total > 0 && (
              <span className="text-xs text-base-content/60">
                {t('tasksCount', { done: tasksSummary.done, total: tasksSummary.total })}
                {tasksSummary.overdue > 0 && <span className="text-error">{' · '}{t('tasksOverdue', { n: tasksSummary.overdue })}</span>}
              </span>
            )}
          </div>
          {tasks.length === 0 && <p className="text-sm text-base-content/40">{t('noTasks')}</p>}
          <ul className="flex flex-col gap-1">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="checkbox checkbox-sm" checked={task.done} disabled={!canEdit || busy} onChange={() => toggle(task)} aria-label={task.text} />
                <span className={`flex-1 ${task.done ? 'line-through text-base-content/40' : ''}`}>{task.text}</span>
                {task.due && <span className={`text-xs ${!task.done && task.due < today ? 'text-error' : 'text-base-content/60'}`}>{fmtDate(task.due)}</span>}
                {canEdit && <button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => removeTask(task)}>{t('remove')}</button>}
              </li>
            ))}
          </ul>
          {canEdit && (
            <form className="flex flex-wrap gap-2" onSubmit={addTask}>
              <input className="input input-sm flex-1 min-w-48" maxLength={200} placeholder={t('taskPlaceholder')} value={newTask.text} onChange={(e) => setNewTask((x) => ({ ...x, text: e.target.value }))} />
              <input type="date" className="input input-sm w-40" value={newTask.due} onChange={(e) => setNewTask((x) => ({ ...x, due: e.target.value }))} aria-label={t('taskDue')} />
              <button type="submit" className="btn btn-sm" disabled={busy || !newTask.text.trim()}>{t('addTask')}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
