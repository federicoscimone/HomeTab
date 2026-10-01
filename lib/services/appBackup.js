import Category from '@/lib/models/Category';
import ImportTemplate from '@/lib/models/ImportTemplate';
import KeywordMapping from '@/lib/models/KeywordMapping';
import Movement from '@/lib/models/Movement';
import AuditLog from '@/lib/models/AuditLog';
import Goal from '@/lib/models/Goal';
import AllocationPlan from '@/lib/models/AllocationPlan';

export async function buildApplicationBackupPayload() {
  const [movements, categories, keywordMappings, importTemplates, auditLogs, goals, allocationPlans] = await Promise.all([
    Movement.find({}).sort({ date: -1, createdAt: -1 }).lean(),
    Category.find({}).sort({ level: 1, name: 1 }).lean(),
    KeywordMapping.find({}).sort({ priority: 1, keyword: 1 }).lean(),
    ImportTemplate.find({}).sort({ createdAt: -1 }).lean(),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(5000).lean(),
    Goal.find({}).sort({ createdAt: 1 }).lean(),
    AllocationPlan.find({}).sort({ effectiveFrom: 1 }).lean(),
  ]);

  return {
    metadata: {
      app: 'HomeBI',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      includedCollections: ['movements', 'categories', 'keywordMappings', 'importTemplates', 'auditLogs', 'goals', 'allocationPlans'],
      excludedCollections: ['users', 'passwordResetTokens'],
      counts: {
        movements: movements.length,
        categories: categories.length,
        keywordMappings: keywordMappings.length,
        importTemplates: importTemplates.length,
        auditLogs: auditLogs.length,
        goals: goals.length,
        allocationPlans: allocationPlans.length,
      },
    },
    data: {
      movements,
      categories,
      keywordMappings,
      importTemplates,
      auditLogs,
      goals,
      allocationPlans,
    },
  };
}

export async function buildApplicationBackupFile() {
  const payload = await buildApplicationBackupPayload();
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');

  return {
    fileName: `homebi-backup-${timestamp}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
    metadata: payload.metadata,
  };
}