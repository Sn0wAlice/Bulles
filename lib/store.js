const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// --- In-memory cache ---
let _cache = null;

function _load() {
  if (_cache) return _cache;
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  _cache = JSON.parse(raw);
  return _cache;
}

function _save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(_cache, null, 2), 'utf-8');
}

function _books() {
  return _load().books;
}

// --- Public API ---

function getAll() {
  return _books();
}

function getById(id) {
  return _books().find(b => b.id === id) || null;
}

function _makeBook(fields) {
  return {
    id: uuidv4(),
    serie: fields.serie || '',
    titre: fields.titre || '',
    numero: fields.numero ? Number(fields.numero) : null,
    status: fields.status || 'not_owned',
    commentaire: fields.commentaire || '',
    web_tracking: fields.web_tracking || '',
    cover_url: fields.cover_url || '',
    tags: Array.isArray(fields.tags) ? fields.tags : (fields.tags ? fields.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
    status_history: [{
      status: fields.status || 'not_owned',
      date: new Date().toISOString(),
    }],
    created_at: new Date().toISOString(),
  };
}

function create(fields) {
  const books = _books();
  const bd = _makeBook(fields);
  books.push(bd);
  _save();
  return bd;
}

function update(id, fields) {
  const books = _books();
  const idx = books.findIndex(b => b.id === id);
  if (idx === -1) return null;
  const allowed = ['serie', 'titre', 'numero', 'status', 'commentaire', 'web_tracking', 'cover_url', 'tags'];
  const oldStatus = books[idx].status;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      if (key === 'numero') {
        books[idx][key] = Number(fields[key]);
      } else if (key === 'tags') {
        books[idx][key] = Array.isArray(fields[key]) ? fields[key] : fields[key].split(',').map(t => t.trim()).filter(Boolean);
      } else {
        books[idx][key] = fields[key];
      }
    }
  }
  // Track status changes
  if (fields.status && fields.status !== oldStatus) {
    if (!books[idx].status_history) books[idx].status_history = [];
    books[idx].status_history.push({
      status: fields.status,
      date: new Date().toISOString(),
    });
  }
  _save();
  return books[idx];
}

function remove(id) {
  const data = _load();
  const before = data.books.length;
  data.books = data.books.filter(b => b.id !== id);
  if (data.books.length === before) return false;
  _save();
  return true;
}

function duplicate(id) {
  const source = getById(id);
  if (!source) return null;
  const books = _books();
  const bd = {
    ...JSON.parse(JSON.stringify(source)),
    id: uuidv4(),
    numero: source.numero != null ? source.numero + 1 : null,
    status_history: [{ status: source.status, date: new Date().toISOString() }],
    created_at: new Date().toISOString(),
  };
  books.push(bd);
  _save();
  return bd;
}

function bulkCreate(items) {
  const books = _books();
  const created = items.map(fields => _makeBook(fields));
  books.push(...created);
  _save();
  return created;
}

// Bulk add tomes: serie + from/to + missing list
function bulkAddTomes({ serie, titre_prefix, from, to, missing, status_owned, status_missing, tags }) {
  const items = [];
  const missingSet = new Set((missing || []).map(Number));
  for (let n = from; n <= to; n++) {
    items.push({
      serie,
      titre: titre_prefix ? `${titre_prefix} - Tome ${n}` : `${serie} - Tome ${n}`,
      numero: n,
      status: missingSet.has(n) ? (status_missing || 'missing') : (status_owned || 'owned'),
      tags: tags || [],
    });
  }
  return bulkCreate(items);
}

// Pre-computed series grouping
function getGroupedBySerie() {
  const books = _books();
  const grouped = {};
  for (const bd of books) {
    const key = bd.serie || 'Sans série';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(bd);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => (a.numero || 0) - (b.numero || 0));
  }
  return grouped;
}

function getAllSeries() {
  const books = _books();
  return [...new Set(books.map(b => b.serie).filter(Boolean))].sort();
}

function getAllTags() {
  const books = _books();
  const tags = new Set();
  for (const b of books) {
    if (b.tags) b.tags.forEach(t => tags.add(t));
  }
  return [...tags].sort();
}

// Serie notes
function getSerieNotes() {
  return _load().serie_notes || {};
}

function setSerieNote(serie, note) {
  const data = _load();
  if (!data.serie_notes) data.serie_notes = {};
  data.serie_notes[serie] = note;
  _save();
}

// Stats
function getStats() {
  const books = _books();
  const byStatus = {};
  const bySerie = {};
  const byTag = {};
  const recentlyAdded = [];

  for (const b of books) {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    const s = b.serie || 'Sans série';
    if (!bySerie[s]) bySerie[s] = { total: 0, owned: 0 };
    bySerie[s].total++;
    if (b.status === 'owned' || b.status === 'owned_no_hs') bySerie[s].owned++;
    if (b.tags) b.tags.forEach(t => { byTag[t] = (byTag[t] || 0) + 1; });
  }

  // Top series by count
  const topSeries = Object.entries(bySerie)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data, pct: Math.round((data.owned / data.total) * 100) }));

  // Recently added (last 10)
  const sorted = [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recent = sorted.slice(0, 10);

  return {
    total: books.length,
    byStatus,
    topSeries,
    byTag,
    recent,
    owned: (byStatus.owned || 0) + (byStatus.owned_no_hs || 0),
    wishlist: (byStatus.not_owned || 0) + (byStatus.missing || 0),
  };
}

module.exports = {
  getAll, getById, create, update, remove, duplicate,
  bulkCreate, bulkAddTomes,
  getGroupedBySerie, getAllSeries, getAllTags,
  getSerieNotes, setSerieNote,
  getStats,
};
