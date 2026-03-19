document.addEventListener('DOMContentLoaded', () => {
  // --- Mobile menu toggle ---
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIconOpen = document.getElementById('menu-icon-open');
  const menuIconClose = document.getElementById('menu-icon-close');

  menuToggle?.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    menuIconOpen.classList.toggle('hidden');
    menuIconClose.classList.toggle('hidden');
  });

  // --- Debounce utility ---
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // --- Inline status change ---
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const status = e.target.value;
      try {
        const res = await fetch(`/api/status/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          e.target.className = e.target.className
            .replace(/text-emerald-400|text-red-400|text-amber-400|text-zinc-500/g, '');
          const colorMap = {
            owned: 'text-emerald-400',
            owned_no_hs: 'text-emerald-400',
            missing: 'text-red-400',
            in_progress: 'text-amber-400',
            not_owned: 'text-zinc-500',
          };
          e.target.classList.add(colorMap[status] || 'text-zinc-500');
        }
      } catch (err) {
        console.error('Status update failed:', err);
      }
    });
  });

  // --- Search & filter with tag support ---
  const searchInput = document.getElementById('search-input');
  const filterSerie = document.getElementById('filter-serie');
  const filterStatus = document.getElementById('filter-status');
  const filterTag = document.getElementById('filter-tag');

  const PER_PAGE = 50;
  let currentPage = 1;
  let allRows = [...document.querySelectorAll('.bd-row')];
  let filteredRows = allRows;

  function applyFilters() {
    const query = (searchInput?.value || '').toLowerCase();
    const serie = filterSerie?.value || '';
    const status = filterStatus?.value || '';
    const tag = filterTag?.value || '';

    filteredRows = allRows.filter(row => {
      const matchSearch = !query || row.dataset.search.includes(query);
      const matchSerie = !serie || row.dataset.serie === serie;
      const matchStatus = !status || row.dataset.status === status;
      const matchTag = !tag || (row.dataset.tags || '').split(',').includes(tag);
      return matchSearch && matchSerie && matchStatus && matchTag;
    });

    currentPage = 1;
    applyPagination();
  }

  function applyPagination() {
    const start = (currentPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const totalPages = Math.ceil(filteredRows.length / PER_PAGE);

    allRows.forEach(r => r.style.display = 'none');
    filteredRows.slice(start, end).forEach(r => r.style.display = '');

    const showingEl = document.getElementById('showing-count');
    if (showingEl) {
      if (filteredRows.length === 0) {
        showingEl.textContent = 'Aucun résultat';
      } else {
        showingEl.textContent = `${start + 1}-${Math.min(end, filteredRows.length)} sur ${filteredRows.length}`;
      }
    }

    const controls = document.getElementById('pagination-controls');
    if (controls && totalPages > 1) {
      controls.innerHTML = '';
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '\u2190';
      prevBtn.className = `px-2 py-1 rounded text-xs ${currentPage <= 1 ? 'text-zinc-700 cursor-default' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`;
      prevBtn.disabled = currentPage <= 1;
      prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; applyPagination(); } });
      controls.appendChild(prevBtn);

      const pageInfo = document.createElement('span');
      pageInfo.textContent = `${currentPage} / ${totalPages}`;
      pageInfo.className = 'text-xs text-zinc-500';
      controls.appendChild(pageInfo);

      const nextBtn = document.createElement('button');
      nextBtn.textContent = '\u2192';
      nextBtn.className = `px-2 py-1 rounded text-xs ${currentPage >= totalPages ? 'text-zinc-700 cursor-default' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`;
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; applyPagination(); } });
      controls.appendChild(nextBtn);
    } else if (controls) {
      controls.innerHTML = '';
    }
  }

  searchInput?.addEventListener('input', debounce(applyFilters, 200));
  filterSerie?.addEventListener('change', applyFilters);
  filterStatus?.addEventListener('change', applyFilters);
  filterTag?.addEventListener('change', applyFilters);

  // Init pagination
  if (allRows.length > 0) applyPagination();

  // --- Column sorting ---
  let sortKey = null;
  let sortAsc = true;

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }

      // Update icons
      document.querySelectorAll('th[data-sort] .sort-icon').forEach(s => s.textContent = '');
      th.querySelector('.sort-icon').textContent = sortAsc ? ' \u25B2' : ' \u25BC';

      // Sort filtered rows
      filteredRows.sort((a, b) => {
        let va = a.dataset[`sort${key.charAt(0).toUpperCase() + key.slice(1)}`] || '';
        let vb = b.dataset[`sort${key.charAt(0).toUpperCase() + key.slice(1)}`] || '';
        if (key === 'numero') {
          va = Number(va); vb = Number(vb);
          return sortAsc ? va - vb : vb - va;
        }
        return sortAsc ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr');
      });

      // Reorder DOM
      const tbody = document.querySelector('#bd-table tbody');
      if (tbody) {
        filteredRows.forEach(row => {
          if (row.tagName === 'TR') tbody.appendChild(row);
        });
      }

      currentPage = 1;
      applyPagination();
    });
  });

  // --- Delete modal ---
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalTitre = document.getElementById('delete-modal-titre');
  const deleteCancel = document.getElementById('delete-cancel');
  const deleteConfirm = document.getElementById('delete-confirm');
  let deleteId = null;

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteId = btn.dataset.id;
      deleteModalTitre.textContent = btn.dataset.titre;
      deleteModal.classList.remove('hidden');
    });
  });

  deleteCancel?.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteId = null;
  });

  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      deleteModal.classList.add('hidden');
      deleteId = null;
    }
  });

  deleteConfirm?.addEventListener('click', async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/bd/${deleteId}`, { method: 'DELETE' });
      // Remove from DOM
      document.querySelectorAll(`.bd-row`).forEach(row => {
        const select = row.querySelector(`.status-select[data-id="${deleteId}"]`);
        const delBtn = row.querySelector(`.btn-delete[data-id="${deleteId}"]`);
        if (select || delBtn) {
          row.remove();
        }
      });
      allRows = [...document.querySelectorAll('.bd-row')];
      filteredRows = filteredRows.filter(r => document.contains(r));
      applyPagination();
    } catch (err) {
      console.error('Delete failed:', err);
    }
    deleteModal.classList.add('hidden');
    deleteId = null;
  });

  // --- Series page search with debounce ---
  const searchSerie = document.getElementById('search-serie');
  searchSerie?.addEventListener('input', debounce(() => {
    const query = searchSerie.value.toLowerCase();
    document.querySelectorAll('.serie-block').forEach(block => {
      block.style.display = !query || block.dataset.serie.includes(query) ? '' : 'none';
    });
  }, 200));

  // --- Serie notes (auto-save) ---
  document.querySelectorAll('.serie-note-input').forEach(textarea => {
    textarea.addEventListener('input', debounce(async () => {
      const serie = textarea.dataset.serie;
      const note = textarea.value;
      try {
        await fetch('/api/serie-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serie, note }),
        });
      } catch (err) {
        console.error('Serie note save failed:', err);
      }
    }, 500));
  });

  // --- Cover search (form page) ---
  const btnSearchCover = document.getElementById('btn-search-cover');
  const coverLoading = document.getElementById('cover-loading');
  const coverPreview = document.getElementById('cover-preview');
  const inputCoverUrl = document.getElementById('input-cover-url');
  const inputCoverUrlManual = document.getElementById('input-cover-url-manual');

  function updateCoverPreview(url) {
    if (url) {
      coverPreview.innerHTML = `<img src="${url}" alt="" class="w-20 h-28 object-cover rounded shadow" onerror="this.parentElement.innerHTML='<div class=\\'w-20 h-28 bg-zinc-800 rounded flex items-center justify-center\\'><span class=\\'text-xs text-red-400\\'>Erreur</span></div>'">`;
      inputCoverUrl.value = url;
      inputCoverUrlManual.value = url;
    }
  }

  btnSearchCover?.addEventListener('click', async () => {
    const titre = document.getElementById('input-titre')?.value;
    const serie = document.getElementById('input-serie')?.value;
    if (!titre && !serie) return;

    coverLoading.classList.remove('hidden');
    btnSearchCover.disabled = true;

    try {
      const res = await fetch('/api/cover/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, serie }),
      });
      const data = await res.json();
      if (data.cover_url) {
        updateCoverPreview(data.cover_url);
      } else {
        coverLoading.textContent = 'Aucune couverture trouvée';
        setTimeout(() => { coverLoading.textContent = 'Recherche...'; coverLoading.classList.add('hidden'); }, 2000);
      }
    } catch (err) {
      console.error('Cover search failed:', err);
    } finally {
      coverLoading.classList.add('hidden');
      btnSearchCover.disabled = false;
    }
  });

  // Manual URL input
  inputCoverUrlManual?.addEventListener('change', () => {
    const url = inputCoverUrlManual.value.trim();
    inputCoverUrl.value = url;
    if (url) updateCoverPreview(url);
  });

  // Cover file upload (edit mode only)
  const coverUploadFile = document.getElementById('cover-upload-file');
  coverUploadFile?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const id = e.target.dataset.id;
    const formData = new FormData();
    formData.append('cover', file);

    try {
      const res = await fetch(`/api/cover/upload/${id}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.cover_url) {
        updateCoverPreview(data.cover_url);
      }
    } catch (err) {
      console.error('Cover upload failed:', err);
    }
  });
});
