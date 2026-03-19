const fs = require('fs');
const { parse } = require('csv-parse/sync');

const STATUS_MAP = {
  'owned': 'owned',
  'owned - no hs': 'owned_no_hs',
  'missing': 'missing',
  'in progress': 'in_progress',
  'not owned': 'not_owned',
};

function normalizeStatus(raw) {
  if (!raw) return 'not_owned';
  const key = raw.trim().toLowerCase();
  return STATUS_MAP[key] || 'not_owned';
}

function parseNotionCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  return records.map(row => ({
    serie: row['Name'] || '',
    titre: row['Titre'] || '',
    numero: row['Numéro'] || row['Numero'] || null,
    status: normalizeStatus(row['Status']),
    commentaire: row['Commentaire'] || '',
    web_tracking: row['Web traking'] || row['Web tracking'] || '',
  }));
}

module.exports = { parseNotionCSV };
