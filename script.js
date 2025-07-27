const itemButtonsDiv = document.getElementById('item-buttons');
const userButtonsDiv = document.getElementById('user-buttons');
const itemSection = document.getElementById('item-section');
const userSection = document.getElementById('user-section');
const usersTbody = document.getElementById('users');
const logDiv = document.getElementById('log');
const versionSpan = document.getElementById('version');
const payCommentInput = document.getElementById('pay-comment');
const totalBalanceP = document.getElementById('total-balance');
const stockDialog = document.getElementById('stock-dialog');
const addItemDialog = document.getElementById('add-item-dialog');
const addItemBtn = document.getElementById('add-item-btn');
const addNameInput = document.getElementById('item-name');
const addPriceInput = document.getElementById('item-price');
const addTypeSelect = document.getElementById('item-type');
const addStockWrap = document.getElementById('item-stock-wrap');
const addStockInput = document.getElementById('item-stock');
const editItemBtn = document.getElementById('edit-item-btn');
const editItemDialog = document.getElementById('edit-item-dialog');
const editItemSelect = document.getElementById('edit-item-select');
const editNameInput = document.getElementById('edit-name');
const editPriceInput = document.getElementById('edit-price');
const editTypeSelect = document.getElementById('edit-type');
const editStockWrap = document.getElementById('edit-stock-wrap');
const editStockInput = document.getElementById('edit-stock');
const statsBtn = document.getElementById('stats-btn');
const statsDialog = document.getElementById('stats-dialog');
const undoBtn = document.getElementById('undo-btn');
const addUserBtn = document.getElementById('add-user-btn');
const editUserBtn = document.getElementById('edit-user-btn');
const addUserDialog = document.getElementById('add-user-dialog');
const addUserName = document.getElementById('add-user-name');
const addUserNoBal = document.getElementById('add-user-nobalance');
const editUserDialog = document.getElementById('edit-user-dialog');
const editUserSelect = document.getElementById('edit-user-select');
const editUserName = document.getElementById('edit-user-name');
const editUserNoBal = document.getElementById('edit-user-nobalance');
let chartItems = null;
let chartUsers = null;
let chartDays = null;

let stockInputs = {}; // mapping itemId -> input element

function cancelSelection() {
  selectedItem = null;
  itemSection.style.display = 'block';
  userSection.style.display = 'none';
  clearTimeout(selectTimeout);
}

function updateAddItemForm() {
  const type = addTypeSelect.value;
  if (type === 'normal') {
    addStockWrap.style.display = 'none';
  } else {
    addStockWrap.style.display = 'block';
  }
}

function updateEditItemForm() {
  const type = editTypeSelect.value;
  if (type === 'normal') {
    editStockWrap.style.display = 'none';
  } else {
    editStockWrap.style.display = 'block';
  }
}

let items = [];
let users = [];
let selectedItem = null;
let selectTimeout = null;

async function fetchJson(url, options={}) {
  const res = await fetch(url, Object.assign({headers:{'Content-Type':'application/json'}}, options));
  if (!res.ok) throw new Error('Request failed');
  return await res.json();
}

async function loadData() {
  items = await fetchJson('/api/items');
  users = await fetchJson('/api/users');
  const v = await fetchJson('/api/version');
  versionSpan.textContent = v.version;
  renderItemButtons();
  renderUserButtons();
  renderUsers();
  renderLogs();
}

function renderItemButtons() {
  itemButtonsDiv.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('div');
    btn.className = 'tile';
    btn.textContent = item.perKg ? `${item.name} (${item.price}€/kg)` : `${item.name} (${item.price}€)`;
    const disabled = typeof item.stock === 'number' && item.stock <= 0;
    if (!disabled) {
      btn.addEventListener('click', () => {
        selectedItem = item;
        itemSection.style.display = 'none';
        userSection.style.display = 'block';
        clearTimeout(selectTimeout);
        selectTimeout = setTimeout(() => {
          if (selectedItem) {
            selectedItem = null;
            itemSection.style.display = 'block';
            userSection.style.display = 'none';
          }
        }, 3000);
      });
    } else {
      btn.classList.add('disabled');
    }
    itemButtonsDiv.appendChild(btn);
  });
}

function renderUserButtons() {
  userButtonsDiv.innerHTML = '';
  // sort by numeric id but ensure HITTN user is always last
  const sorted = [...users].sort((a,b)=>parseInt(a.id)-parseInt(b.id));
  const hittnIndex = sorted.findIndex(u => u.name === 'HITTN');
  if (hittnIndex !== -1) {
    const [hittn] = sorted.splice(hittnIndex, 1);
    sorted.push(hittn);
  }
  sorted.forEach(user => {
    const btn = document.createElement('div');
    btn.className = 'tile';
    if (user.name === 'HITTN' || user.name === 'BAR') {
      btn.classList.add('hittn');
    }
    btn.textContent = user.name;
    btn.addEventListener('click', async () => {
      if (!selectedItem) return;
      let weight = 0;
      let qty = 1;
      if (selectedItem.perKg) {
        const wVal = prompt('Gesamtgewicht in kg?');
        if (wVal === null) { cancelSelection(); return; }
        weight = parseFloat(wVal.replace(',', '.')) || 0;
        const qVal = prompt('St\u00fcckzahl?');
        if (qVal === null) { cancelSelection(); return; }
        qty = parseInt(qVal) || 0;
      }
      let payload = {itemId:selectedItem.id, userId:user.id, weight, qty};
      if (user.noBalance && user.name === 'HITTN') {
        const comment = prompt('Kommentar eingeben?');
        if (comment === null) { cancelSelection(); return; }
        payload.comment = comment;
      }
      await fetchJson('/api/order', {method:'POST', body:JSON.stringify(payload)});
      cancelSelection();
      await loadData();
    });
    userButtonsDiv.appendChild(btn);
  });
}

function renderUsers() {
  usersTbody.innerHTML = '';
  let total = 0;
  users
    .filter(u => !u.noBalance)
    .sort((a,b)=>b.balance - a.balance)
    .forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${user.name}</td><td>${user.balance.toFixed(2)} €</td>`;
      usersTbody.appendChild(tr);
      if (user.balance > 0) total += user.balance;
    });
  totalBalanceP.textContent = `Summe offen: ${total.toFixed(2)} €`;
}

async function renderLogs() {
  const logs = await fetchJson('/api/logs?limit=8');
  logDiv.innerHTML = logs.map(l => `${l.timestamp} - ${l.msg}`).reverse().join('<br>');
}


document.getElementById('pay-btn').addEventListener('click', () => {
  document.getElementById('pay-dialog').style.display = 'block';
  const select = document.getElementById('pay-user');
  const payUsers = users.filter(u => !u.noBalance);
  select.innerHTML = payUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  function updatePayAmount() {
    const u = users.find(us => us.id === select.value);
    document.getElementById('pay-amount').value = u ? u.balance.toFixed(2) : '0';
  }
  updatePayAmount();
  select.addEventListener('change', updatePayAmount);
  payCommentInput.value = '';
});

document.getElementById('pay-cancel').addEventListener('click', () => {
  document.getElementById('pay-dialog').style.display = 'none';
});

document.getElementById('pay-ok').addEventListener('click', async () => {
  const userId = document.getElementById('pay-user').value;
  const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
  const comment = payCommentInput.value.trim();
  await fetchJson('/api/pay', {method:'POST', body:JSON.stringify({userId, amount, comment})});
  document.getElementById('pay-dialog').style.display = 'none';
  await loadData();
});


document.getElementById('full-log-btn').addEventListener('click', async () => {
  const res = await fetch('/api/logs?csv=1');
  const text = await res.text();
  const blob = new Blob([text], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'log.csv';
  a.click();
  URL.revokeObjectURL(url);
});

undoBtn.addEventListener('click', async () => {
  if (!confirm('Letzten Vorgang stornieren?')) return;
  await fetchJson('/api/undo', {method:'POST'});
  await loadData();
});

document.getElementById('stock-btn').addEventListener('click', () => {
  stockDialog.innerHTML = '';
  stockInputs = {};
  items.filter(i => typeof i.stock === 'number').forEach(item => {
    const label = document.createElement('label');
    label.textContent = `${item.name} Bestand`;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = item.stock;
    stockDialog.appendChild(label);
    stockDialog.appendChild(input);
    stockInputs[item.id] = input;
  });
  const ok = document.createElement('button');
  ok.textContent = 'Speichern';
  const cancel = document.createElement('button');
  cancel.textContent = 'Abbrechen';
  stockDialog.appendChild(ok);
  stockDialog.appendChild(cancel);
  stockDialog.style.display = 'block';
  ok.addEventListener('click', async () => {
    const stocks = {};
    Object.keys(stockInputs).forEach(id => {
      stocks[id] = parseFloat(stockInputs[id].value) || 0;
    });
    await fetchJson('/api/stock', {method:'POST', body:JSON.stringify({stocks})});
    stockDialog.style.display = 'none';
    await loadData();
  });
  cancel.addEventListener('click', () => {
    stockDialog.style.display = 'none';
  });
});



addItemBtn.addEventListener('click', () => {
  addNameInput.value = '';
  addPriceInput.value = '';
  addTypeSelect.value = 'normal';
  addStockInput.value = '0';
  updateAddItemForm();
  addItemDialog.style.display = 'block';
});

document.getElementById('item-add-cancel').addEventListener('click', () => {
  addItemDialog.style.display = 'none';
});

document.getElementById('item-add-ok').addEventListener('click', async () => {
  const name = addNameInput.value.trim();
  const price = parseFloat(addPriceInput.value) || 0;
  const type = addTypeSelect.value;
  const perKg = type === 'fish';
  const stockVal = parseFloat(addStockInput.value);
  const stock = (type === 'stock' || type === 'fish') && !isNaN(stockVal) ? stockVal : undefined;
  await fetchJson('/api/items', {method:'POST', body:JSON.stringify({name, price, perKg, stock})});
  addItemDialog.style.display = 'none';
  await loadData();
});

addTypeSelect.addEventListener('change', updateAddItemForm);

function populateEditFields() {
  const item = items.find(i => i.id === editItemSelect.value);
  if (!item) return;
  editNameInput.value = item.name;
  editPriceInput.value = item.price;
  if (item.perKg) {
    editTypeSelect.value = 'fish';
  } else if (typeof item.stock === 'number') {
    editTypeSelect.value = 'stock';
  } else {
    editTypeSelect.value = 'normal';
  }
  updateEditItemForm();
  editStockInput.value = typeof item.stock === 'number' ? item.stock : 0;
}



editItemBtn.addEventListener('click', () => {
  editItemSelect.innerHTML = items.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
  populateEditFields();
  editItemDialog.style.display = 'block';
});

editItemSelect.addEventListener('change', populateEditFields);
editTypeSelect.addEventListener('change', updateEditItemForm);

document.getElementById('edit-item-cancel').addEventListener('click', () => {
  editItemDialog.style.display = 'none';
});

addUserBtn.addEventListener('click', () => {
  addUserName.value = '';
  addUserNoBal.checked = false;
  addUserDialog.style.display = 'block';
});

document.getElementById('add-user-cancel').addEventListener('click', () => {
  addUserDialog.style.display = 'none';
});

document.getElementById('add-user-ok').addEventListener('click', async () => {
  const name = addUserName.value.trim();
  const noBalance = addUserNoBal.checked;
  await fetchJson('/api/users', {method:'POST', body:JSON.stringify({name, noBalance})});
  addUserDialog.style.display = 'none';
  await loadData();
});

function populateEditUserFields() {
  const user = users.find(u => u.id === editUserSelect.value);
  if (!user) return;
  editUserName.value = user.name;
  editUserNoBal.checked = !!user.noBalance;
}

editUserBtn.addEventListener('click', () => {
  editUserSelect.innerHTML = users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  populateEditUserFields();
  editUserDialog.style.display = 'block';
});

editUserSelect.addEventListener('change', populateEditUserFields);

document.getElementById('edit-user-cancel').addEventListener('click', () => {
  editUserDialog.style.display = 'none';
});

document.getElementById('edit-user-ok').addEventListener('click', async () => {
  const id = editUserSelect.value;
  const name = editUserName.value.trim();
  const noBalance = editUserNoBal.checked;
  await fetchJson(`/api/users/${id}`, {method:'PUT', body:JSON.stringify({name, noBalance})});
  editUserDialog.style.display = 'none';
  await loadData();
});

document.getElementById('edit-item-ok').addEventListener('click', async () => {
  const id = editItemSelect.value;
  const name = editNameInput.value.trim();
  const price = parseFloat(editPriceInput.value) || 0;
  const type = editTypeSelect.value;
  const perKg = type === 'fish';
  const stockVal = parseFloat(editStockInput.value);
  const stock = (type === 'stock' || type === 'fish') && !isNaN(stockVal) ? stockVal : undefined;
  await fetchJson(`/api/items/${id}`, {method:'PUT', body:JSON.stringify({name, price, perKg, stock})});
  editItemDialog.style.display = 'none';
  await loadData();
});

statsBtn.addEventListener('click', () => {
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const startVal = `${today}T00:00`;
  const endVal = `${today}T23:59`;
  const nameOptions = users.map(u=>`<option value="${u.name}">${u.name}</option>`).join('');
  const itemOptions = items.map(i=>`<option value="${i.name}">${i.name}</option>`).join('');
  statsDialog.innerHTML = `
    <label>Von <input type="datetime-local" id="stats-start" value="${startVal}"></label>
    <label>Bis <input type="datetime-local" id="stats-end" value="${endVal}"></label>
    <label>Name <select id="stats-name"><option value="">Alle</option>${nameOptions}</select></label>
    <label>Artikel <select id="stats-item"><option value="">Alle</option>${itemOptions}</select></label>
    <button id="stats-refresh">Anzeigen</button>
    <div id="stats-charts">
      <div style="height:200px"><canvas id="stats-items"></canvas></div>
      <div style="height:200px"><canvas id="stats-users"></canvas></div>
      <div style="height:200px"><canvas id="stats-days"></canvas></div>
    </div>
    <button id="stats-close">Schließen</button>`;
  statsDialog.style.display = 'block';
  document.getElementById('stats-close').addEventListener('click', () => {
    statsDialog.style.display = 'none';
  });
  document.getElementById('stats-refresh').addEventListener('click', loadStats);
  loadStats();
});

async function loadStats() {
  const start = document.getElementById('stats-start').value;
  const end = document.getElementById('stats-end').value;
  const name = document.getElementById('stats-name').value;
  const item = document.getElementById('stats-item').value;
  const params = new URLSearchParams({ start, end });
  if (name) params.append('name', name);
  if (item) params.append('item', item);
  const stats = await fetchJson(`/api/stats?${params.toString()}`);
  if (chartItems) chartItems.destroy();
  if (chartUsers) chartUsers.destroy();
  if (chartDays) chartDays.destroy();
  const ctx1 = document.getElementById('stats-items').getContext('2d');
  chartItems = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: stats.items.map(i=>i.name),
      datasets: [
        { label: 'Umsatz (€)', data: stats.items.map(i=>i.revenue), backgroundColor: 'rgba(75,192,192,0.6)' },
        { label: 'Stück', data: stats.items.map(i=>i.pieces), backgroundColor: 'rgba(200,200,50,0.6)' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
  const ctx2 = document.getElementById('stats-users').getContext('2d');
  chartUsers = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: stats.users.map(u=>u.name),
      datasets: [
        { label: 'Käufe (€)', data: stats.users.map(u=>u.purchases), backgroundColor: 'rgba(54,162,235,0.6)' },
        { label: 'Zahlungen (€)', data: stats.users.map(u=>u.payments), backgroundColor: 'rgba(255,99,132,0.6)' },
        { label: 'Stück', data: stats.users.map(u=>u.pieces), backgroundColor: 'rgba(100,200,100,0.6)' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
  const ctx3 = document.getElementById('stats-days').getContext('2d');
  chartDays = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: stats.days.map(d=>d.day),
      datasets: [
        { label: 'Umsatz (€)', data: stats.days.map(d=>d.revenue), backgroundColor: 'rgba(150,150,250,0.6)' },
        { label: 'Stück', data: stats.days.map(d=>d.pieces), backgroundColor: 'rgba(250,150,100,0.6)' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

document.addEventListener('DOMContentLoaded', loadData);
