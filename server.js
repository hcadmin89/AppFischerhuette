const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// Allow overriding the application directory so data and static files can live
// elsewhere. By default use the directory of this script.
const APP_DIR = process.env.APP_DIR || __dirname;
const DB_FILE = path.join(APP_DIR, 'db.json');
const VERSION = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'))).version;
let db = { users: [], items: [], logs: [] };

function initDB() {
  const names = ['Haschi','Rene','Fabi','Seppi','Essl','Mechtl','Spinx','Pasci','Stachzi','Walta','Roman','Jan','Hannes','BAR','HITTN'];
  db.users = names.map((name, idx) => {
    const user = { id: String(idx), name, balance: 0 };
    if (name === 'HITTN' || name === 'BAR') user.noBalance = true;
    return user;
  });
  db.items = [
    { id: '0', name: 'Bier', price: 2, perKg: false },
    { id: '1', name: 'Spitzer', price: 2, perKg: false },
    { id: '2', name: 'Limo', price: 1, perKg: false },
    { id: '3', name: 'Mineral', price: 1, perKg: false },
    { id: '4', name: 'Pizza', price: 7, perKg: false, stock: 10 },
    { id: '5', name: 'Forelle', price: 13, perKg: true, stock: 10 },
    { id: '6', name: 'Zander', price: 15, perKg: true, stock: 10 }
  ];
  db.logs = [];
  saveDB();
}

function loadDB() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.users || !db.items || !db.logs) throw new Error('invalid db');
    const forelle = db.items.find(i => i.name === 'Forelle');
    if (forelle && typeof forelle.stock !== 'number') forelle.stock = 0;
    const pizza = db.items.find(i => i.name === 'Pizza');
    if (pizza && typeof pizza.stock !== 'number') pizza.stock = 0;
    const hittn = db.users.find(u => u.name === 'HITTN');
    if (hittn && hittn.noBalance !== true) hittn.noBalance = true;
    const bar = db.users.find(u => u.name === 'BAR');
    if (bar && bar.noBalance !== true) bar.noBalance = true;
  } catch (e) {
    initDB();
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function addItem(data) {
  const { name, price, perKg, stock } = data;
  if (!name || typeof price !== 'number') return null;
  const id = Date.now().toString();
  const item = { id, name, price, perKg: !!perKg };
  if (typeof stock === 'number') item.stock = stock;
  db.items.push(item);
  db.logs.push({ timestamp: timestamp(), msg: `Artikel ${name} hinzugefügt` });
  saveDB();
  return item;
}

function updateItem(id, data) {
  const item = db.items.find(i => i.id === id);
  if (!item) return false;
  if (data.name) item.name = data.name;
  if (typeof data.price === 'number') item.price = data.price;
  if (typeof data.perKg !== 'undefined') {
    item.perKg = !!data.perKg;
  }
  if ('stock' in data) {
    if (typeof data.stock === 'number') {
      item.stock = data.stock;
    } else {
      delete item.stock;
    }
  } else if (data.perKg === false) {
    delete item.stock;
  }
  db.logs.push({ timestamp: timestamp(), msg: `Artikel ${item.name} bearbeitet` });
  saveDB();
  return true;
}

function addUser(data) {
  const { name, noBalance } = data;
  if (!name) return null;
  const id = Date.now().toString();
  const user = { id, name, balance: 0 };
  if (noBalance) user.noBalance = true;
  db.users.push(user);
  db.logs.push({ timestamp: timestamp(), msg: `User ${name} angelegt` });
  saveDB();
  return user;
}

function updateUser(id, data) {
  const user = db.users.find(u => u.id === id);
  if (!user) return false;
  if (data.name) user.name = data.name;
  if (typeof data.noBalance !== 'undefined') {
    if (data.noBalance) user.noBalance = true; else delete user.noBalance;
  }
  db.logs.push({ timestamp: timestamp(), msg: `User ${user.name} bearbeitet` });
  saveDB();
  return true;
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const year = d.getFullYear() % 100;
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${pad(year)} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseTimestamp(ts) {
  const [date, time] = ts.split(' ');
  if (!date || !time) return new Date(NaN);
  const [d, m, y] = date.split('.').map(Number);
  const year = y < 100 ? 2000 + y : y;
  const parts = time.split(':').map(Number);
  const hh = parts[0] || 0;
  const mm = parts[1] || 0;
  const ss = parts[2] || 0;
  return new Date(year, m - 1, d, hh, mm, ss);
}

function computeStats(start, end, nameFilter, itemFilter) {
  const itemStats = {};
  const userStats = {};
  const dayStats = {};
  db.logs.forEach(l => {
    const ts = parseTimestamp(l.timestamp);
    if (start && ts < start) return;
    if (end && ts > end) return;
    const mBuy = l.msg.match(/^(.+?) kauft (.+?)(?: ([0-9.,]+)kg, ([0-9]+) Stk|\((\d+) Stk\))? \(([-0-9.,]+)€\)/);
    const mPay = l.msg.match(/^([^ ]+) zahlt ([-0-9.,]+)€/);
    if (mBuy) {
      const user = mBuy[1];
      if (nameFilter && user !== nameFilter) return;
      const item = mBuy[2].trim();
      if (itemFilter && item !== itemFilter) return;
      const weight = mBuy[3] ? parseFloat(mBuy[3].replace(',', '.')) : 0;
      const qty = mBuy[4] ? parseInt(mBuy[4]) : (mBuy[5] ? parseInt(mBuy[5]) : 1);
      const price = parseFloat(mBuy[6].replace(',', '.')) || 0;
      if (!itemStats[item]) itemStats[item] = { revenue: 0, pieces: 0 };
      itemStats[item].revenue += price;
      itemStats[item].pieces += qty;
      if (!userStats[user]) userStats[user] = { purchases: 0, payments: 0, pieces: 0 };
      userStats[user].purchases += price;
      userStats[user].pieces += qty;
      const day = l.timestamp.split(' ')[0];
      if (!dayStats[day]) dayStats[day] = { revenue: 0, pieces: 0 };
      dayStats[day].revenue += price;
      dayStats[day].pieces += qty;
    } else if (mPay) {
      const user = mPay[1];
      if (nameFilter && user !== nameFilter) return;
      const amount = parseFloat(mPay[2].replace(',', '.')) || 0;
      if (!userStats[user]) userStats[user] = { purchases: 0, payments: 0, pieces: 0 };
      userStats[user].payments += amount;
    }
  });
  const items = Object.entries(itemStats).map(([name, s]) => ({ name, revenue: s.revenue, pieces: s.pieces }));
  const users = Object.entries(userStats).map(([name, s]) => ({ name, purchases: s.purchases, payments: s.payments, pieces: s.pieces }));
  const days = Object.entries(dayStats).map(([day, s]) => ({ day, revenue: s.revenue, pieces: s.pieces }))
    .sort((a,b)=> parseTimestamp(`${a.day} 00:00:00`) - parseTimestamp(`${b.day} 00:00:00`));
  return { items, users, days };
}

function startServer() {
  http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      handleApi(req, res, pathname);
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      serveFile(res, 'index.html', 'text/html');
    } else if (pathname.endsWith('.js')) {
      serveFile(res, pathname.slice(1), 'text/javascript');
    } else if (pathname.endsWith('.css')) {
      serveFile(res, pathname.slice(1), 'text/css');
    } else {
      send(res, 404, 'Not found', 'text/plain');
    }
  }).listen(PORT, () => console.log('Server running on', PORT));
}

loadDB();
startServer();

function getPostData(req, cb) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try { cb(JSON.parse(body || '{}')); } catch (e) { cb({}); }
  });
}

function send(res, code, data, type='application/json') {
  res.writeHead(code, {'Content-Type': type});
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(path.join(APP_DIR, filePath));
    send(res, 200, data, contentType);
  } catch (e) {
    send(res, 404, 'Not found', 'text/plain');
  }
}



function handleOrder(req, res) {
  getPostData(req, data => {
    const { itemId, userId, weight, qty, comment } = data;
    const item = db.items.find(i => i.id === itemId);
    const user = db.users.find(u => u.id === userId);
    if (!item || !user) { send(res, 400, { ok:false }); return; }
    // quantity of pieces sold; ensure a non-negative integer
    let quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity < 0) quantity = 0;
    const w = parseFloat(weight || 0);
    let price;
    let logInfo = '';
    if (item.perKg) {
      price = item.price * w;
      if (typeof item.stock === 'number') {
        item.stock -= quantity;
        if (item.stock < 0) item.stock = 0;
      }
      logInfo = ` ${w.toFixed(2)}kg, ${quantity} Stk`;
    } else {
      price = item.price * quantity;
      if (typeof item.stock === 'number') {
        item.stock -= quantity;
        if (item.stock < 0) item.stock = 0;
      }
      logInfo = ` (${quantity} Stk)`;
    }
    if (!user.noBalance) {
      user.balance += price;
    }
    let msg = `${user.name} kauft ${item.name}${logInfo} (${price.toFixed(2)}€)`;
    if (user.name === 'HITTN' && comment) {
      msg += ` - ${comment}`;
    }
    db.logs.push({ timestamp: timestamp(), msg });
    saveDB();
    send(res, 200, { ok: true });
  });
}

function handlePay(req, res) {
  getPostData(req, data => {
    const { userId, amount, comment } = data;
    const user = db.users.find(u => u.id === userId);
    if (!user) { send(res,400,{ok:false}); return; }
    const val = parseFloat(amount || 0);
    user.balance -= val;
    const msg = comment ? `${user.name} zahlt ${val.toFixed(2)}€ (${comment})` :
      `${user.name} zahlt ${val.toFixed(2)}€`;
    db.logs.push({ timestamp: timestamp(), msg });
    saveDB();
    send(res, 200, { ok: true });
  });
}

function handleUpdateStock(req, res) {
  getPostData(req, data => {
    const { stocks } = data;
    if (stocks && typeof stocks === 'object') {
      Object.keys(stocks).forEach(id => {
        const item = db.items.find(i => i.id === id);
        if (item && typeof item.stock === 'number') {
          item.stock = parseFloat(stocks[id]) || 0;
        }
      });
      saveDB();
    }
    send(res, 200, { ok: true });
  });
}

function handleUndo(req, res) {
  let idx = db.logs.length - 1;
  while (idx >= 0 && db.logs[idx].msg.startsWith('Storno:')) idx--;
  if (idx < 0) { send(res,200,{ok:false}); return; }
  const last = db.logs.splice(idx,1)[0];
  const buy = last.msg.match(/^(.+?) kauft (.+?)(?: ([0-9.,]+)kg, ([0-9]+) Stk| \((\d+) Stk\)) \(([0-9.,-]+)€\)/);
  const pay = last.msg.match(/^([^ ]+) zahlt ([0-9.,-]+)€/);
  if (buy) {
    const userName = buy[1];
    const itemName = buy[2].trim();
    const qty = buy[4] ? parseInt(buy[4]) : (buy[5] ? parseInt(buy[5]) : 1);
    const price = parseFloat(buy[6].replace(',', '.')) || 0;
    const user = db.users.find(u => u.name === userName);
    const item = db.items.find(i => i.name === itemName);
    if (user && !user.noBalance) user.balance -= price;
    if (item && typeof item.stock === 'number') item.stock += qty;
  } else if (pay) {
    const userName = pay[1];
    const amount = parseFloat(pay[2].replace(',', '.')) || 0;
    const user = db.users.find(u => u.name === userName);
    if (user) user.balance += amount;
  }
  db.logs.push({ timestamp: timestamp(), msg: `Storno: ${last.msg}` });
  saveDB();
  send(res, 200, { ok: true });
}

function handleApi(req, res, pathname) {
  if (pathname === '/api/items' && req.method === 'GET') {
    send(res, 200, db.items);
  } else if (pathname === '/api/users' && req.method === 'GET') {
    // return raw list so the client can sort differently for tiles and balances
    send(res, 200, db.users);
  } else if (pathname === '/api/users' && req.method === 'POST') {
    getPostData(req, data => {
      const user = addUser(data);
      if (user) send(res, 200, user); else send(res, 400, {ok:false});
    });
  } else if (pathname.startsWith('/api/users/') && req.method === 'PUT') {
    const id = pathname.split('/')[3];
    getPostData(req, data => {
      const ok = updateUser(id, data);
      if (ok) send(res, 200, {ok:true}); else send(res, 404, {ok:false});
    });
  } else if (pathname === '/api/order' && req.method === 'POST') {
    handleOrder(req, res);
  } else if (pathname === '/api/pay' && req.method === 'POST') {
    handlePay(req, res);
  } else if (pathname === '/api/stock' && req.method === 'POST') {
    handleUpdateStock(req, res);
  } else if (pathname === '/api/undo' && req.method === 'POST') {
    handleUndo(req, res);
  } else if (pathname === '/api/items' && req.method === 'POST') {
    getPostData(req, data => {
      data.price = parseFloat(data.price);
      if (typeof data.stock !== 'undefined') data.stock = parseFloat(data.stock);
      const item = addItem(data);
      if (item) send(res, 200, item); else send(res, 400, {ok:false});
    });
  } else if (pathname.startsWith('/api/items/') && req.method === 'PUT') {
    const id = pathname.split('/')[3];
    getPostData(req, data => {
      if (typeof data.price !== 'undefined') data.price = parseFloat(data.price);
      if (typeof data.stock !== 'undefined') data.stock = parseFloat(data.stock);
      const ok = updateItem(id, data);
      if (ok) send(res, 200, { ok: true }); else send(res, 404, { ok:false });
    });
  } else if (pathname === '/api/logs' && req.method === 'GET') {
    const params = new URL(req.url, 'http://x').searchParams;
    const limit = parseInt(params.get('limit') || '0');
    const arr = limit ? db.logs.slice(-limit) : db.logs;
    if (params.get('csv')) {
      const csv = arr.map(l => `${l.timestamp};${l.msg.replace(/"/g,'""')}`).join('\n');
      send(res, 200, csv, 'text/csv');
    } else {
      send(res, 200, arr);
    }
  } else if (pathname === '/api/stats' && req.method === 'GET') {
    const params = new URL(req.url, 'http://x').searchParams;
    const startStr = params.get('start');
    const endStr = params.get('end');
    const name = params.get('name') || undefined;
    const item = params.get('item') || undefined;
    const start = startStr ? new Date(startStr) : undefined;
    const end = endStr ? new Date(endStr) : undefined;
    send(res, 200, computeStats(start, end, name, item));
  } else if (pathname === '/api/version' && req.method === 'GET') {
    send(res, 200, { version: VERSION });
  } else {
    send(res, 404, 'not found', 'text/plain');
  }
}

