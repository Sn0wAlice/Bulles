const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const multer = require('multer');
const migrator = require('./lib/migrator');
const store = require('./lib/store');
const { searchCover } = require('./lib/covers');
const { parseNotionCSV } = require('./lib/csv-import');

// Run migrations before anything else
migrator.run();

const app = express();

// Cover upload storage
const coverStorage = multer.diskStorage({
  destination: path.join(__dirname, 'public', 'uploads', 'covers'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, req.params.id + ext);
  },
});
const uploadCover = multer({
  storage: coverStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
const uploadCSV = multer({ dest: path.join(__dirname, 'uploads') });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const STATUSES = [
  { value: 'owned', label: 'Possédé' },
  { value: 'owned_no_hs', label: 'Possédé (sans HS)' },
  { value: 'missing', label: 'Manquant' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'not_owned', label: 'Non possédé' },
];

function statusLabel(value) {
  const s = STATUSES.find(s => s.value === value);
  return s ? s.label : value;
}

// Inject counts into all views for nav badges
app.use((req, res, next) => {
  const all = store.getAll();
  res.locals.navCounts = {
    collection: all.filter(b => b.status === 'owned' || b.status === 'owned_no_hs').length,
    wishlist: all.filter(b => b.status === 'not_owned' || b.status === 'missing').length,
    total: all.length,
  };
  next();
});

// --- Pages ---

app.get('/', (req, res) => {
  const all = store.getAll();
  const owned = all.filter(b => b.status === 'owned' || b.status === 'owned_no_hs');
  res.render('collection', {
    title: 'Ma collection',
    bds: owned,
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    statusLabel,
    query: req.query,
    currentPage: 'collection',
  });
});

app.get('/wishlist', (req, res) => {
  const all = store.getAll();
  const wish = all.filter(b => b.status === 'not_owned' || b.status === 'missing');
  res.render('collection', {
    title: 'Wishlist',
    bds: wish,
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    statusLabel,
    query: req.query,
    currentPage: 'wishlist',
  });
});

app.get('/series', (req, res) => {
  const grouped = store.getGroupedBySerie();
  const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'fr'));
  const serieNotes = store.getSerieNotes();
  res.render('series', {
    title: 'Par série',
    grouped,
    sortedKeys,
    serieNotes,
    statuses: STATUSES,
    statusLabel,
    currentPage: 'series',
  });
});

app.get('/all', (req, res) => {
  res.render('collection', {
    title: 'Toutes les BDs',
    bds: store.getAll(),
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    statusLabel,
    query: req.query,
    currentPage: 'all',
  });
});

app.get('/dashboard', (req, res) => {
  const stats = store.getStats();
  res.render('dashboard', {
    title: 'Dashboard',
    stats,
    statuses: STATUSES,
    statusLabel,
    currentPage: 'dashboard',
  });
});

// --- CRUD ---

app.get('/add', (req, res) => {
  res.render('form', {
    title: 'Ajouter une BD',
    bd: null,
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    currentPage: 'add',
  });
});

app.post('/add', (req, res) => {
  store.create(req.body);
  const referer = req.body._redirect || '/';
  res.redirect(referer);
});

app.get('/bulk-add', (req, res) => {
  res.render('bulk-add', {
    title: 'Ajout en série',
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    currentPage: 'add',
    result: null,
  });
});

app.post('/bulk-add', (req, res) => {
  const { serie, titre_prefix, from, to, missing, status_owned, status_missing, tags } = req.body;
  const missingArr = missing ? missing.split(',').map(s => s.trim()).filter(Boolean).map(Number) : [];
  const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const created = store.bulkAddTomes({
    serie,
    titre_prefix: titre_prefix || '',
    from: Number(from),
    to: Number(to),
    missing: missingArr,
    status_owned: status_owned || 'owned',
    status_missing: status_missing || 'missing',
    tags: tagsArr,
  });
  res.render('bulk-add', {
    title: 'Ajout en série',
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    currentPage: 'add',
    result: { count: created.length },
  });
});

app.get('/edit/:id', (req, res) => {
  const bd = store.getById(req.params.id);
  if (!bd) return res.redirect('/');
  res.render('form', {
    title: 'Modifier',
    bd,
    series: store.getAllSeries(),
    tags: store.getAllTags(),
    statuses: STATUSES,
    currentPage: '',
  });
});

app.post('/edit/:id', (req, res) => {
  store.update(req.params.id, req.body);
  const referer = req.body._redirect || '/';
  res.redirect(referer);
});

app.post('/delete/:id', (req, res) => {
  store.remove(req.params.id);
  const referer = req.body._redirect || '/';
  res.redirect(referer);
});

app.post('/duplicate/:id', (req, res) => {
  const bd = store.duplicate(req.params.id);
  if (bd) return res.redirect('/edit/' + bd.id);
  res.redirect('/');
});

// --- API ---

app.post('/api/status/:id', (req, res) => {
  const { status } = req.body;
  const bd = store.update(req.params.id, { status });
  if (!bd) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, status: bd.status, label: statusLabel(bd.status) });
});

app.post('/api/cover/search', async (req, res) => {
  const { titre, serie } = req.body;
  if (!titre && !serie) return res.status(400).json({ error: 'titre or serie required' });
  const url = await searchCover(titre, serie);
  res.json({ ok: true, cover_url: url });
});

app.post('/api/cover/upload/:id', uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const coverPath = '/uploads/covers/' + req.file.filename;
  store.update(req.params.id, { cover_url: coverPath });
  res.json({ ok: true, cover_url: coverPath });
});

app.post('/api/serie-note', (req, res) => {
  const { serie, note } = req.body;
  if (!serie) return res.status(400).json({ error: 'serie required' });
  store.setSerieNote(serie, note || '');
  res.json({ ok: true });
});

app.delete('/api/bd/:id', (req, res) => {
  const ok = store.remove(req.params.id);
  res.json({ ok });
});

// --- Export ---

app.get('/export/json', (req, res) => {
  const all = store.getAll();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="bulles-export.json"');
  res.json(all);
});

app.get('/export/csv', (req, res) => {
  const all = store.getAll();
  const headers = ['Serie', 'Titre', 'Numero', 'Status', 'Commentaire', 'Web Tracking', 'Tags', 'Cover URL'];
  const rows = all.map(b => [
    b.serie, b.titre, b.numero ?? '', b.status,
    b.commentaire, b.web_tracking,
    (b.tags || []).join(';'), b.cover_url,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bulles-export.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel
});

// --- CSV Import ---

app.get('/import', (req, res) => {
  res.render('import', { title: 'Importer / Exporter', currentPage: 'import', result: null });
});

app.post('/import', uploadCSV.single('csvfile'), (req, res) => {
  if (!req.file) {
    return res.render('import', { title: 'Importer / Exporter', currentPage: 'import', result: { error: 'Aucun fichier sélectionné.' } });
  }
  try {
    const items = parseNotionCSV(req.file.path);
    const created = store.bulkCreate(items);
    res.render('import', {
      title: 'Importer / Exporter',
      currentPage: 'import',
      result: { count: created.length },
    });
  } catch (err) {
    res.render('import', {
      title: 'Importer / Exporter',
      currentPage: 'import',
      result: { error: 'Erreur de parsing : ' + err.message },
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bulles running on http://localhost:${PORT}`);
});
