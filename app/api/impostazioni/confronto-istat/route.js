/**
 * @fileoverview API route — /api/impostazioni/confronto-istat
 * PUT — profilo della famiglia e corrispondenza fra categorie e capitoli ISTAT.
 *
 * Body (tutti facoltativi):
 *   region        {string|null}  - Codice ISTAT della regione (es. "ITC4"), null per toglierlo.
 *   members       {number|null}  - Componenti, da 1 a 5 (5 = «5 o più»).
 *   mappings      {Object}       - { [categoryId]: "01".."13" | null }.
 *   applyDefaults {boolean}      - Assegna il capitolo predefinito alle categorie del seed che non
 *                                  ne hanno uno; quelle già assegnate non si toccano.
 *
 * Aperto anche nella demo: sono dati come le categorie, e il ripristino notturno li riporta indietro.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import HouseholdProfile from '@/lib/models/HouseholdProfile';
import { DIVISIONS, defaultCoicop } from '@/lib/utils/coicop';
import { MAX_MEMBERS, REGIONS } from '@/lib/utils/istat';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

const MAX_MAPPINGS = 500;

/** @returns {{ profile: object|null, mappings: [string, string|null][], applyDefaults: boolean }|null} */
function parseBody(body) {
  if (!body || typeof body !== 'object') return null;
  const profile = {};
  if ('region' in body) {
    if (body.region !== null && !(body.region in REGIONS)) return null;
    profile.region = body.region;
  }
  if ('members' in body) {
    if (body.members !== null && !(Number.isInteger(body.members) && body.members >= 1 && body.members <= MAX_MEMBERS)) return null;
    profile.members = body.members;
  }
  const mappings = Object.entries(body.mappings ?? {});
  if (mappings.length > MAX_MAPPINGS) return null;
  for (const [id, code] of mappings) {
    if (!mongoose.isValidObjectId(id) || (code !== null && !DIVISIONS.includes(code))) return null;
  }
  return { profile: Object.keys(profile).length ? profile : null, mappings, applyDefaults: body.applyDefaults === true };
}

/** Il capitolo predefinito per ogni categoria che non ne ha uno e il cui nome è uno del seed. */
async function defaultsForUnmapped() {
  const cats = await Category.find({ level: { $in: [1, 2] } }).select('name level parentId coicop').lean();
  const byId = new Map(cats.map((c) => [String(c._id), c]));
  return cats.filter((c) => !c.coicop).flatMap((c) => {
    const code = c.level === 1 ? defaultCoicop(c.name) : defaultCoicop(byId.get(String(c.parentId))?.name ?? '', c.name);
    return code ? [[String(c._id), code]] : [];
  });
}

export async function PUT(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;

  const input = parseBody(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });

  await connectDB();
  const changes = [];
  if (input.profile) {
    await HouseholdProfile.updateOne({ _id: 'household' }, { $set: { ...input.profile, updatedBy: session.user.id } }, { upsert: true });
    changes.push(`profilo (${Object.entries(input.profile).map(([k, v]) => `${k}: ${v ?? '—'}`).join(', ')})`);
  }
  const mappings = input.applyDefaults ? await defaultsForUnmapped() : input.mappings;
  if (mappings.length) {
    await Category.bulkWrite(mappings.map(([id, code]) => ({
      updateOne: { filter: { _id: new mongoose.Types.ObjectId(id) }, update: { $set: { coicop: code } } },
    })));
    changes.push(`${mappings.length} corrispondenze ${input.applyDefaults ? 'predefinite applicate' : 'modificate'}`);
  }

  if (changes.length) {
    await writeAudit(session, req, {
      action: 'UPDATE',
      resource: 'system',
      resourceId: 'istat',
      description: `Confronto con le famiglie simili: ${changes.join('; ')}`,
      meta: { profile: input.profile, mappings: mappings.length },
    });
  }
  return NextResponse.json({ ok: true, applied: mappings.length });
}
