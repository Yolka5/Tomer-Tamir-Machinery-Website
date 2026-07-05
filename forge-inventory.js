/* TTM FORGE OS — Inventory module (Firestore-backed, real-time) */

let db, user, toast, logActivity;
let fs; // firestore functions

let categories = [];
let items = [];
let filters = { search: '', categoryId: 'all', lowOnly: false };
let editingItemId = null;

const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isLow(item) {
  return item.minQty != null && item.minQty !== '' && Number(item.qty) <= Number(item.minQty);
}

function categoryName(id) {
  const cat = categories.find((c) => c.id === id);
  return cat ? cat.name : 'Uncategorized';
}

/* ---------- Rendering ---------- */

function renderChips() {
  const wrap = $('inv-chips');
  if (!wrap) return;

  let html =
    `<button type="button" class="os-chip ${filters.categoryId === 'all' && !filters.lowOnly ? 'is-active' : ''}" data-cat="all">All</button>`;

  categories.forEach((cat) => {
    html += `<button type="button" class="os-chip ${filters.categoryId === cat.id ? 'is-active' : ''}" data-cat="${esc(cat.id)}">${esc(cat.name)}</button>`;
  });

  const lowCount = items.filter(isLow).length;
  html += `<button type="button" class="os-chip os-chip--warn ${filters.lowOnly ? 'is-active' : ''}" data-cat="__low">Low stock${lowCount ? ' · ' + lowCount : ''}</button>`;

  wrap.innerHTML = html;

  wrap.querySelectorAll('.os-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.cat;
      if (val === '__low') {
        filters.lowOnly = !filters.lowOnly;
      } else {
        filters.categoryId = val;
        filters.lowOnly = false;
      }
      renderChips();
      renderTable();
    });
  });
}

function visibleItems() {
  const q = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
    if (filters.lowOnly && !isLow(item)) return false;
    if (q) {
      const hay = [item.name, item.sku, item.location].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function renderTable() {
  const body = $('inv-table-body');
  const empty = $('inv-empty');
  if (!body) return;

  const list = visibleItems();

  if (!list.length) {
    body.innerHTML = '';
    if (empty) {
      empty.hidden = false;
      empty.querySelector('strong').textContent = items.length ? 'No matching items' : 'No items yet';
    }
    return;
  }
  if (empty) empty.hidden = true;

  body.innerHTML = list.map((item) => {
    const stock = Number(item.qty) <= 0 ? 'out' : (isLow(item) ? 'low' : 'ok');
    return `
    <tr class="${stock === 'out' ? 'is-out' : (stock === 'low' ? 'is-low' : '')}" data-id="${esc(item.id)}">
      <td><span class="os-dot os-dot--${stock}"></span>${esc(item.name)}${item.notes ? ` <span class="dim" title="${esc(item.notes)}">✎</span>` : ''}</td>
      <td>${esc(item.sku) || '—'}</td>
      <td>${esc(categoryName(item.categoryId))}</td>
      <td>
        <span class="os-qty">
          <button type="button" data-act="dec" aria-label="Decrease">−</button>
          <span class="os-qty__num os-qty__num--${stock}">${esc(item.qty)}${item.unit ? ' <small class="dim">' + esc(item.unit) + '</small>' : ''}</span>
          <button type="button" data-act="inc" aria-label="Increase">+</button>
        </span>
      </td>
      <td>${item.minQty != null && item.minQty !== '' ? esc(item.minQty) : '—'}</td>
      <td>${esc(item.location) || '—'}</td>
      <td class="os-td-actions">
        <button type="button" class="os-btn--icon os-btn" data-act="edit">Edit</button>
        <button type="button" class="os-btn--icon os-btn" data-act="del">✕</button>
      </td>
    </tr>
  `;
  }).join('');

  body.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('tr').dataset.id;
      const act = btn.dataset.act;
      if (act === 'inc') adjustQty(id, 1);
      else if (act === 'dec') adjustQty(id, -1);
      else if (act === 'edit') openItemModal(id);
      else if (act === 'del') deleteItem(id);
    });
  });
}

function renderOverview() {
  const low = items.filter(isLow);

  const kpiItems = $('kpi-items');
  const kpiLow = $('kpi-low');
  const kpiCats = $('kpi-cats');
  if (kpiItems) kpiItems.textContent = items.length;
  if (kpiLow) kpiLow.textContent = low.length;
  if (kpiCats) kpiCats.textContent = categories.length;

  const lowList = $('overview-low-list');
  if (lowList) {
    lowList.innerHTML = low.length
      ? low.slice(0, 6).map((item) =>
          `<li><span>${esc(item.name)} <span class="dim">· ${esc(item.qty)} left (min ${esc(item.minQty)})</span></span><span class="os-status os-status--warn">Low</span></li>`
        ).join('')
      : '<li><span class="dim">No low-stock alerts. All good.</span></li>';
  }

  const recentList = $('overview-recent-list');
  if (recentList) {
    const recent = items.slice().sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0)).slice(0, 6);
    recentList.innerHTML = recent.length
      ? recent.map((item) =>
          `<li><span>${esc(item.name)}</span><span class="dim">${esc(item.updatedBy || '')}</span></li>`
        ).join('')
      : '<li><span class="dim">Nothing here yet.</span></li>';
  }
}

function renderAll() {
  renderChips();
  renderTable();
  renderOverview();
  renderCategorySelect();
}

/* ---------- Modals ---------- */

function renderCategorySelect() {
  const sel = $('item-category');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML =
    '<option value="">Uncategorized</option>' +
    categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if (current) sel.value = current;
}

function openItemModal(itemId) {
  editingItemId = itemId || null;
  const item = itemId ? items.find((i) => i.id === itemId) : null;

  $('item-modal-title').textContent = item ? 'Edit item' : 'Add item';
  $('item-name').value = item ? item.name : '';
  $('item-sku').value = item ? item.sku || '' : '';
  renderCategorySelect();
  $('item-category').value = item ? item.categoryId || '' : '';
  $('item-qty').value = item ? item.qty : '';
  $('item-unit').value = item ? item.unit || '' : '';
  $('item-min').value = item && item.minQty != null ? item.minQty : '';
  $('item-location').value = item ? item.location || '' : '';
  $('item-notes').value = item ? item.notes || '' : '';

  $('item-modal').hidden = false;
  $('item-name').focus();
}

function closeItemModal() {
  $('item-modal').hidden = true;
  editingItemId = null;
}

function renderCategoryManager() {
  const list = $('cat-list');
  if (!list) return;

  list.innerHTML = categories.length
    ? categories.map((cat) => `
        <div class="os-cat-row" data-id="${esc(cat.id)}">
          <input type="text" value="${esc(cat.name)}" aria-label="Category name">
          <button type="button" class="os-btn os-btn--icon" data-act="rename">Save</button>
          <button type="button" class="os-btn os-btn--icon" data-act="del">✕</button>
        </div>
      `).join('')
    : '<p class="dim" style="font-size:0.8125rem; color:#6b6b73;">No categories yet — add one below.</p>';

  list.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.os-cat-row');
      const id = row.dataset.id;
      if (btn.dataset.act === 'rename') {
        const name = row.querySelector('input').value.trim();
        if (!name) return;
        await fs.updateDoc(fs.doc(db, 'inventoryCategories', id), { name });
        toast('Category renamed');
        logActivity('Renamed category to "' + name + '"');
      } else {
        if (!confirm('Delete this category? Items in it become Uncategorized.')) return;
        const oldName = categoryName(id);
        await fs.deleteDoc(fs.doc(db, 'inventoryCategories', id));
        toast('Category deleted');
        logActivity('Deleted category "' + oldName + '"');
      }
    });
  });
}

/* ---------- Data operations ---------- */

async function adjustQty(id, delta) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  const next = Math.max(0, Number(item.qty) + delta);
  try {
    await fs.updateDoc(fs.doc(db, 'inventoryItems', id), {
      qty: next,
      updatedAt: fs.serverTimestamp(),
      updatedBy: user.displayName || user.email || ''
    });
    if (item.minQty != null && item.minQty !== '' && next <= Number(item.minQty) && Number(item.qty) > Number(item.minQty)) {
      logActivity('"' + item.name + '" dropped to low stock (' + next + ')');
    }
  } catch (err) {
    toast('Update failed: ' + err.message, true);
  }
}

async function deleteItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  if (!confirm('Delete "' + item.name + '" from inventory?')) return;
  try {
    await fs.deleteDoc(fs.doc(db, 'inventoryItems', id));
    toast('Item deleted');
    logActivity('Deleted item "' + item.name + '"');
  } catch (err) {
    toast('Delete failed: ' + err.message, true);
  }
}

async function saveItem(e) {
  e.preventDefault();

  const data = {
    name: $('item-name').value.trim(),
    sku: $('item-sku').value.trim(),
    categoryId: $('item-category').value || '',
    qty: Number($('item-qty').value) || 0,
    unit: $('item-unit').value.trim(),
    minQty: $('item-min').value === '' ? null : Number($('item-min').value),
    location: $('item-location').value.trim(),
    notes: $('item-notes').value.trim(),
    updatedAt: fs.serverTimestamp(),
    updatedBy: user.displayName || user.email || ''
  };

  if (!data.name) return;

  try {
    if (editingItemId) {
      await fs.updateDoc(fs.doc(db, 'inventoryItems', editingItemId), data);
      toast('Item updated');
      logActivity('Updated item "' + data.name + '"');
    } else {
      data.createdAt = fs.serverTimestamp();
      await fs.addDoc(fs.collection(db, 'inventoryItems'), data);
      toast('Item added');
      logActivity('Added item "' + data.name + '"');
    }
    closeItemModal();
  } catch (err) {
    toast('Save failed: ' + err.message, true);
  }
}

async function addCategory(e) {
  e.preventDefault();
  const input = $('cat-new-name');
  const name = input.value.trim();
  if (!name) return;
  try {
    await fs.addDoc(fs.collection(db, 'inventoryCategories'), {
      name,
      createdAt: fs.serverTimestamp()
    });
    input.value = '';
    toast('Category added');
    logActivity('Added category "' + name + '"');
  } catch (err) {
    toast('Save failed: ' + err.message, true);
  }
}

/* ---------- Init ---------- */

export function getItems() {
  return items;
}

export function openAddItem() {
  if (fs) openItemModal(null);
}

export function openEditItem(id) {
  if (fs) openItemModal(id);
}

export function openCategoryManager() {
  if (!fs) return;
  renderCategoryManager();
  $('cat-modal').hidden = false;
}

export function exportInventoryCsv() {
  if (!items.length) {
    if (toast) toast('Nothing to export yet', true);
    return;
  }
  const header = ['Name', 'SKU', 'Category', 'Qty', 'Unit', 'Min stock', 'Location', 'Notes', 'Last updated by'];
  const rows = items.map((i) => [
    i.name, i.sku || '', categoryName(i.categoryId), i.qty, i.unit || '',
    i.minQty != null ? i.minQty : '', i.location || '', i.notes || '', i.updatedBy || ''
  ]);
  const csv = [header].concat(rows)
    .map((r) => r.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ttm-inventory-' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  if (toast) toast('Inventory exported');
  if (logActivity) logActivity('Exported inventory CSV');
}

export async function initInventory(database, currentUser, showToast, logFn) {
  db = database;
  user = currentUser;
  toast = showToast;
  logActivity = logFn || function () {};

  fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  /* Live listeners */
  fs.onSnapshot(
    fs.query(fs.collection(db, 'inventoryCategories'), fs.orderBy('name')),
    (snap) => {
      categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
      if (!$('cat-modal').hidden) renderCategoryManager();
    },
    (err) => toast('Categories: ' + err.message, true)
  );

  fs.onSnapshot(
    fs.query(fs.collection(db, 'inventoryItems'), fs.orderBy('name')),
    (snap) => {
      items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          updatedAtMs: data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0
        };
      });
      renderAll();
    },
    (err) => toast('Inventory: ' + err.message, true)
  );

  /* UI events */
  $('btn-add-item').addEventListener('click', () => openItemModal(null));
  $('item-cancel').addEventListener('click', closeItemModal);
  $('item-form').addEventListener('submit', saveItem);
  $('item-modal').addEventListener('click', (e) => {
    if (e.target === $('item-modal')) closeItemModal();
  });

  $('btn-manage-cats').addEventListener('click', openCategoryManager);

  const exportBtn = $('btn-export-csv');
  if (exportBtn) exportBtn.addEventListener('click', exportInventoryCsv);
  $('cat-close').addEventListener('click', () => { $('cat-modal').hidden = true; });
  $('cat-form').addEventListener('submit', addCategory);
  $('cat-modal').addEventListener('click', (e) => {
    if (e.target === $('cat-modal')) $('cat-modal').hidden = true;
  });

  $('inv-search').addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderTable();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeItemModal();
      $('cat-modal').hidden = true;
    }
  });
}
