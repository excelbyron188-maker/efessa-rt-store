require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to your local .env file or hosting environment variables.');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
  console.error('Missing ADMIN_PASSWORD or ADMIN_SESSION_SECRET. Configure both before starting the store.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.disable('x-powered-by');
// A single admin save can contain several validated image uploads (up to 2 MB each).
app.use(express.json({ limit: '24mb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const cookieName = IS_PRODUCTION ? '__Host-efessa_admin' : 'efessa_admin';
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function sign(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('base64url');
}
function makeAdminToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function isAdmin(req) {
  const raw = req.headers.cookie || '';
  const pair = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`));
  if (!pair) return false;
  const token = decodeURIComponent(pair.slice(cookieName.length + 1));
  const parts = token.split('.');
  if (parts.length !== 2 || !safeEqual(sign(parts[0]), parts[1])) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return payload.role === 'admin' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ success: false, message: 'Please sign in as an administrator.' });
  next();
}
function setAdminCookie(res) {
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(makeAdminToken())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${IS_PRODUCTION ? '; Secure' : ''}`);
}
function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${IS_PRODUCTION ? '; Secure' : ''}`);
}
function text(value, max = 200) { return String(value ?? '').trim().slice(0, max); }
function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; }
function reference(prefix = 'EF') { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(80) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      category VARCHAR(60) NOT NULL,
      price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
      old_price NUMERIC(12,2),
      badge VARCHAR(80) NOT NULL DEFAULT '',
      image TEXT NOT NULL,
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      description TEXT NOT NULL DEFAULT '',
      colors JSONB NOT NULL DEFAULT '[]'::jsonb,
      sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_reference VARCHAR(80) UNIQUE NOT NULL,
      customer_name VARCHAR(180) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(60) NOT NULL,
      delivery_address TEXT NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      delivery_note TEXT NOT NULL DEFAULT '',
      items JSONB NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL,
      delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
      payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      order_status VARCHAR(30) NOT NULL DEFAULT 'awaiting_payment',
      inventory_released BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      local_delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
      national_delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
      local_state VARCHAR(100) NOT NULL DEFAULT '',
      state_delivery_fees JSONB NOT NULL DEFAULT '{}'::jsonb,
      hero_image TEXT NOT NULL DEFAULT '',
      campaign_image TEXT NOT NULL DEFAULT '',
      category_images JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'NGN';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_released BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS state_delivery_fees JSONB NOT NULL DEFAULT '{}'::jsonb;
    CREATE TABLE IF NOT EXISTS state_delivery_rates (
      state_key VARCHAR(120) PRIMARY KEY,
      state_name VARCHAR(120) NOT NULL,
      delivery_fee NUMERIC(12,2) NOT NULL CHECK (delivery_fee >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS hero_image TEXT NOT NULL DEFAULT '';
    ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS campaign_image TEXT NOT NULL DEFAULT '';
    ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS category_images JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
  await pool.query('INSERT INTO store_settings (id, local_state) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [text(process.env.STORE_STATE, 100)]);
  // One-time-compatible migration: retain any rates saved by earlier versions in the JSONB settings column.
  await pool.query(`
    INSERT INTO state_delivery_rates (state_key, state_name, delivery_fee)
    SELECT LOWER(REGEXP_REPLACE(TRIM(entry.key), '\\s+', ' ', 'g')), TRIM(entry.key), entry.value::numeric
    FROM store_settings settings
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(settings.state_delivery_fees, '{}'::jsonb)) AS entry(key, value)
    WHERE settings.id=1 AND TRIM(entry.key) <> '' AND entry.value ~ '^[0-9]+(\\.[0-9]+)?$'
    ON CONFLICT (state_key) DO NOTHING
  `);
  // Clear the legacy copy after migration so deleted rates cannot reappear after a future restart.
  await pool.query("UPDATE store_settings SET state_delivery_fees='{}'::jsonb WHERE id=1");

  console.log("Database ready. Product catalogue is managed from the admin dashboard.");
}

function productFromRow(row) {
  return { id: row.id, name: row.name, category: row.category, price: Number(row.price), oldPrice: row.old_price == null ? null : Number(row.old_price), badge: row.badge, image: row.image, images: row.images, description: row.description, colors: row.colors, sizes: row.sizes, stock: row.stock, featured: row.featured, active: row.active };
}
function orderFromRow(row) {
  return { id: row.order_reference, createdAt: row.created_at, status: row.order_status, paymentStatus: row.payment_status, customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone, address: row.delivery_address, city: row.city, state: row.state, note: row.delivery_note }, items: row.items, subtotal: Number(row.subtotal), delivery: Number(row.delivery_fee), total: Number(row.total) };
}

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ success: true, service: 'EFESSA RT', database: 'connected' }); }
  catch (error) { console.error('Health check:', error.message); res.status(503).json({ success: false, message: 'Database connection failed.' }); }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE active = TRUE ORDER BY created_at ASC, id ASC');
    res.json({ success: true, products: result.rows.map(productFromRow) });
  } catch (error) { console.error('Product listing:', error.message); res.status(500).json({ success: false, message: 'Could not load products.' }); }
});

app.get('/api/settings/public', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  try {
    const { rows } = await pool.query('SELECT local_delivery_fee, national_delivery_fee, local_state, hero_image, campaign_image, category_images FROM store_settings WHERE id=1');
    const s = rows[0] || { local_delivery_fee: 0, national_delivery_fee: 0, local_state: '', hero_image: '', campaign_image: '', category_images: {} };
    const rateRows = await pool.query('SELECT state_name, delivery_fee FROM state_delivery_rates ORDER BY state_name');
    const stateDeliveryFees = Object.fromEntries(rateRows.rows.map(rate => [rate.state_name, Number(rate.delivery_fee)]));
    res.json({ success: true, settings: { localDeliveryFee: Number(s.local_delivery_fee), nationalDeliveryFee: Number(s.national_delivery_fee), localState: s.local_state, stateDeliveryFees, heroImage: s.hero_image || '', campaignImage: s.campaign_image || '', categoryImages: s.category_images || {} } });
  } catch (error) { console.error('Settings:', error.message); res.status(500).json({ success: false, message: 'Could not load delivery settings.' }); }
});

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body?.password || '');
  if (!safeEqual(password, process.env.ADMIN_PASSWORD)) return res.status(401).json({ success: false, message: 'The administrator password is incorrect.' });
  setAdminCookie(res);
  res.json({ success: true, message: 'Signed in successfully.' });
});
app.get('/api/admin/me', (req, res) => res.json({ success: true, authenticated: isAdmin(req) }));
app.post('/api/admin/logout', (req, res) => { clearAdminCookie(res); res.json({ success: true }); });

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC'); res.json({ success: true, products: rows.map(productFromRow) }); }
  catch (error) { console.error(error.message); res.status(500).json({ success: false, message: 'Could not load products.' }); }
});
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const name = text(b.name, 180), category = text(b.category, 60), price = Number(b.price), stock = Number(b.stock ?? 0);
  const allowed = ['tops', 'jeans', 'dresses', 'heels', 'bags', 'hoodies', 'tshirts', 'sweatshirts', 'accessories'];
  if (!name || !allowed.includes(category) || !Number.isFinite(price) || price < 1 || !Number.isInteger(stock) || stock < 0) return res.status(400).json({ success: false, message: 'Enter a product name, valid category, positive price and whole-number stock.' });
  const image = String(b.image || '').trim();
  const isUploadedImage = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) && image.length <= 2800000;
  const isLocalImage = image.startsWith('/') && !image.startsWith('//') && image.length <= 1000;
  const isHttpsImage = /^https:\/\//i.test(image) && image.length <= 1000;
  if (!isUploadedImage && !isLocalImage && !isHttpsImage) return res.status(400).json({ success: false, message: 'A product image is required. Upload a JPG, PNG, or WebP image up to 2 MB, or enter a valid HTTPS image URL.' });
  const id = `prod-${crypto.randomBytes(8).toString('hex')}`;
  try {
    const { rows } = await pool.query(`INSERT INTO products (id,name,category,price,badge,image,images,description,colors,sizes,stock,featured)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, name, category, money(price), text(b.badge, 80), image, JSON.stringify([image]), text(b.description, 2000), JSON.stringify(Array.isArray(b.colors) ? b.colors.slice(0,20).map(x=>text(x,40)) : []), JSON.stringify(Array.isArray(b.sizes) ? b.sizes.slice(0,30).map(x=>text(x,20)) : []), stock, b.featured === true]);
    res.status(201).json({ success: true, product: productFromRow(rows[0]) });
  } catch (error) { console.error(error.message); res.status(500).json({ success: false, message: 'Could not save product.' }); }
});
app.patch('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const updates = [];
  const values = [];
  const allowedCategories = ['tops', 'jeans', 'dresses', 'heels', 'bags', 'hoodies', 'tshirts', 'sweatshirts', 'accessories'];
  const fields = {
    name: { column: 'name', transform: v => text(v, 180) },
    category: { column: 'category', transform: v => text(v, 60) },
    price: { column: 'price', transform: v => money(v) },
    stock: { column: 'stock', transform: v => Number(v) },
    active: { column: 'active', transform: v => v === true || v === 'true' },
    featured: { column: 'featured', transform: v => v === true || v === 'true' },
    image: { column: 'image', transform: v => String(v ?? '').trim() },
    description: { column: 'description', transform: v => text(v, 2000) },
    badge: { column: 'badge', transform: v => text(v, 80) },
    colors: { column: 'colors', json: true, transform: v => (Array.isArray(v) ? v : String(v ?? '').split(',')).slice(0, 20).map(x => text(x, 40)).filter(Boolean) },
    sizes: { column: 'sizes', json: true, transform: v => (Array.isArray(v) ? v : String(v ?? '').split(',')).slice(0, 30).map(x => text(x, 20)).filter(Boolean) }
  };
  for (const [key, config] of Object.entries(fields)) {
    if (!Object.hasOwn(b, key)) continue;
    const value = config.transform(b[key]);
    if (key === 'name' && !value) return res.status(400).json({ success: false, message: 'Product name cannot be empty.' });
    if (key === 'category' && !allowedCategories.includes(value)) return res.status(400).json({ success: false, message: 'Choose a valid product category.' });
    if (key === 'price' && (!Number.isFinite(Number(b[key])) || Number(b[key]) < 1)) return res.status(400).json({ success: false, message: 'Price must be at least ₦1.' });
    if (key === 'stock' && (!Number.isInteger(Number(b[key])) || Number(b[key]) < 0)) return res.status(400).json({ success: false, message: 'Stock must be a whole number of zero or more.' });
    if (key === 'image' && !(value.startsWith('/') && !value.startsWith('//') && value.length <= 1000) && !(/^https:\/\//i.test(value) && value.length <= 1000) && !(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length <= 2800000)) return res.status(400).json({ success: false, message: 'Invalid product image. Use a JPG, PNG, or WebP upload up to 2 MB, or a valid HTTPS URL.' });
    values.push(config.json ? JSON.stringify(value) : value);
    updates.push(`${config.column}=$${values.length}${config.json ? '::jsonb' : ''}`);
    if (key === 'image') {
      values.push(JSON.stringify([value]));
      updates.push(`images=$${values.length}::jsonb`);
    }
  }
  if (!updates.length) return res.status(400).json({ success: false, message: 'No valid changes provided.' });
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE products SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product: productFromRow(rows[0]) });
  } catch (error) { console.error('Product update:', error.message); res.status(500).json({ success: false, message: 'Could not update product.' }); }
});
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  // Orders keep a snapshot of each purchased item, so removing a catalogue item
  // does not erase or change existing customer orders.
  try { const result = await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]); if (!result.rowCount) return res.status(404).json({success:false,message:'Product not found.'}); res.json({success:true}); }
  catch (error) { console.error(error.message); res.status(500).json({success:false,message:'Could not permanently remove product.'}); }
});

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const { rows } = await pool.query('SELECT local_delivery_fee,national_delivery_fee,local_state,hero_image,campaign_image,category_images FROM store_settings WHERE id=1');
    const s = rows[0] || { local_delivery_fee: 0, national_delivery_fee: 0, local_state: '', hero_image: '', campaign_image: '', category_images: {} };
    const rateRows = await pool.query('SELECT state_name,delivery_fee FROM state_delivery_rates ORDER BY state_name');
    const stateDeliveryFees = Object.fromEntries(rateRows.rows.map(rate => [rate.state_name, Number(rate.delivery_fee)]));
    res.json({success:true,settings:{localDeliveryFee:Number(s.local_delivery_fee),nationalDeliveryFee:Number(s.national_delivery_fee),localState:s.local_state,stateDeliveryFees,heroImage:s.hero_image||'',campaignImage:s.campaign_image||'',categoryImages:s.category_images||{}}});
  } catch(error){ console.error('Admin settings load failed:', error.message); res.status(500).json({success:false,message:'Could not load settings.'}); }
});
// State-specific rates are stored in their own table so saving fallback fees cannot overwrite them.
app.put('/api/admin/delivery-rates', requireAdmin, async (req, res) => {
  const suppliedFees = req.body?.stateDeliveryFees;
  if (!suppliedFees || typeof suppliedFees !== 'object' || Array.isArray(suppliedFees) || Object.keys(suppliedFees).length > 100) {
    return res.status(400).json({ success: false, message: 'Enter valid delivery rates for individual states.' });
  }
  const cleanFees = [];
  const seen = new Set();
  for (const [name, value] of Object.entries(suppliedFees)) {
    const cleanName = text(name, 120).replace(/\s+/g, ' ');
    const amount = Number(value);
    const key = cleanName.toLocaleLowerCase('en-NG').replace(/\s+/g, ' ').trim();
    if (!cleanName || !Number.isFinite(amount) || amount < 0 || amount > 10000000) {
      return res.status(400).json({ success: false, message: 'Each state needs a name and a delivery fee between ₦0 and ₦10,000,000.' });
    }
    if (seen.has(key)) return res.status(400).json({ success: false, message: `Duplicate state name: ${cleanName}.` });
    seen.add(key);
    cleanFees.push({ key, name: cleanName, fee: money(amount) });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM state_delivery_rates');
    for (const rate of cleanFees) {
      await client.query(
        'INSERT INTO state_delivery_rates (state_key,state_name,delivery_fee,updated_at) VALUES ($1,$2,$3,NOW())',
        [rate.key, rate.name, rate.fee]
      );
    }
    const verify = await client.query('SELECT state_key,state_name,delivery_fee FROM state_delivery_rates ORDER BY state_key');
    if (verify.rowCount !== cleanFees.length) throw new Error('Verification failed: saved state count did not match.');
    const expectedByKey = new Map(cleanFees.map(rate => [rate.key, rate.fee]));
    for (const row of verify.rows) {
      const expected = expectedByKey.get(row.state_key);
      if (expected === undefined || Math.abs(Number(row.delivery_fee) - expected) > 0.001) {
        throw new Error(`Verification failed for state delivery rate: ${row.state_name}`);
      }
    }
    await client.query('COMMIT');
    const persisted = Object.fromEntries(verify.rows.map(rate => [rate.state_name, Number(rate.delivery_fee)]));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ success: true, stateDeliveryFees: persisted, message: 'State delivery prices saved and verified in the database.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('State delivery rates save failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not save state delivery prices. Check the server logs and database connection, then try again.' });
  } finally { client.release(); }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const local = Number(req.body?.localDeliveryFee), national = Number(req.body?.nationalDeliveryFee), state = text(req.body?.localState, 100);
  if (![local, national].every(n => Number.isFinite(n) && n >= 0 && n <= 10000000)) return res.status(400).json({ success: false, message: 'Fallback delivery fees must be between ₦0 and ₦10,000,000.' });
  try {
    const saved = await pool.query(
      'UPDATE store_settings SET local_delivery_fee=$1,national_delivery_fee=$2,local_state=$3,updated_at=NOW() WHERE id=1 RETURNING id',
      [money(local), money(national), state]
    );
    if (!saved.rowCount) return res.status(500).json({ success: false, message: 'Store settings are not initialized. Restart the server and try again.' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (error) { console.error('Fallback delivery settings save failed:', error.message); res.status(500).json({ success: false, message: 'Could not save fallback delivery settings.' }); }
});

function validSiteImage(value) {
  const v = String(value ?? '').trim();
  return v === '' ||
    (v.startsWith('/') && !v.startsWith('//') && v.length <= 1000) ||
    (/^https:\/\//i.test(v) && v.length <= 1000) ||
    (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) && v.length <= 2800000);
}
app.put('/api/admin/site-images', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const allowedCategories = ['tops','jeans','dresses','heels','bags'];
  const updates = [];
  const values = [];
  for (const [key, column] of [['heroImage','hero_image'],['campaignImage','campaign_image']]) {
    if (Object.hasOwn(b, key)) {
      const value = String(b[key] ?? '').trim();
      if (!validSiteImage(value)) return res.status(400).json({success:false,message:`Invalid ${key} image. Use a JPG, PNG, or WebP upload up to 2 MB, or a valid HTTPS image URL.`});
      values.push(value); updates.push(`${column}=$${values.length}`);
    }
  }
  if (Object.hasOwn(b, 'categoryImages')) {
    if (!b.categoryImages || typeof b.categoryImages !== 'object' || Array.isArray(b.categoryImages)) return res.status(400).json({success:false,message:'Category images must be an object.'});
    const { rows } = await pool.query('SELECT category_images FROM store_settings WHERE id=1');
    const categoryImages = { ...(rows[0]?.category_images || {}) };
    for (const category of allowedCategories) {
      if (Object.hasOwn(b.categoryImages, category)) {
        const value = String(b.categoryImages[category] ?? '').trim();
        if (!validSiteImage(value)) return res.status(400).json({success:false,message:`Invalid ${category} image.`});
        categoryImages[category] = value;
      }
    }
    values.push(JSON.stringify(categoryImages)); updates.push(`category_images=$${values.length}::jsonb`);
  }
  if (!updates.length) return res.status(400).json({success:false,message:'No image changes were supplied.'});
  values.push(1);
  try { await pool.query(`UPDATE store_settings SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`, values); res.json({success:true,message:'Website images saved.'}); }
  catch(error){ console.error(error.message); res.status(500).json({success:false,message:'Could not save website images.'}); }
});

app.post('/api/checkout', async (req, res) => {
  const b = req.body || {}, c = b.customer || {}, cart = b.items;
  const customer = { name:text(c.name,180), email:text(c.email,255).toLowerCase(), phone:text(c.phone,60), address:text(c.address,1000), city:text(c.city,100), state:text(c.state,100), note:text(c.note,1000) };
  if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) || !customer.phone || !customer.address || !customer.city || !customer.state) return res.status(400).json({success:false,message:'Complete all required delivery details with a valid email address.'});
  if (!Array.isArray(cart) || !cart.length || cart.length > 50) return res.status(400).json({success:false,message:'Your shopping bag is empty or invalid.'});
  const normalized = new Map();
  for (const item of cart) {
    const id=text(item?.id,80), quantity=Number(item?.quantity);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({success:false,message:'One or more cart items have an invalid quantity.'});
    const key = `${id}::${text(item?.size,30)}::${text(item?.color,30)}`;
    normalized.set(key, {id, size:text(item?.size,30), color:text(item?.color,30), quantity:(normalized.get(key)?.quantity || 0)+quantity});
  }
  const client = await pool.connect();
  let orderRef;
  try {
    await client.query('BEGIN');
    const lockedProducts = new Map();
    for (const item of normalized.values()) {
      const result = await client.query('SELECT * FROM products WHERE id=$1 AND active=TRUE FOR UPDATE', [item.id]);
      const product = result.rows[0];
      if (!product) throw Object.assign(new Error('A product in your bag is no longer available. Please refresh your bag.'), {status:400});
      if (Number(product.stock) < item.quantity) throw Object.assign(new Error(`${product.name} does not have enough stock for your requested quantity.`), {status:409});
      lockedProducts.set(item.id, product);
    }
    const items = [];
    let subtotal = 0;
    for (const item of normalized.values()) {
      const p = lockedProducts.get(item.id);
      const price = Number(p.price);
      subtotal += price * item.quantity;
      items.push({id:p.id,name:p.name,category:p.category,price,image:p.image,size:item.size,color:item.color,quantity:item.quantity});
      await client.query('UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2',[item.quantity,p.id]);
    }
    const settingResult = await client.query('SELECT local_delivery_fee,national_delivery_fee,local_state FROM store_settings WHERE id=1');
    const settings = settingResult.rows[0] || {local_delivery_fee:0,national_delivery_fee:0,local_state:''};
    const normalizeState = value => String(value || '').trim().toLocaleLowerCase('en-NG').replace(/\s+/g, ' ');
    const stateAliases = value => { const key = normalizeState(value); return ['fct', 'abuja', 'federal capital territory'].includes(key) ? ['fct', 'abuja', 'federal capital territory'] : [key]; };
    const normalizedState = normalizeState(customer.state);
    const rateResult = await client.query('SELECT state_name,delivery_fee FROM state_delivery_rates');
    const aliases = stateAliases(normalizedState);
    const matchedStateFee = rateResult.rows.find(rate => aliases.includes(normalizeState(rate.state_name)) || stateAliases(rate.state_name).includes(normalizedState));
    const localState = normalizeState(settings.local_state);
    const delivery = matchedStateFee ? Number(matchedStateFee.delivery_fee) : (localState && normalizedState === localState ? Number(settings.local_delivery_fee) : Number(settings.national_delivery_fee));
    const total = money(subtotal + delivery);
    orderRef = reference();
    await client.query(`INSERT INTO orders (order_reference,customer_name,customer_email,customer_phone,delivery_address,city,state,delivery_note,items,subtotal,delivery_fee,total,payment_status,order_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending','received')`,
      [orderRef,customer.name,customer.email,customer.phone,customer.address,customer.city,customer.state,customer.note,JSON.stringify(items),money(subtotal),money(delivery),total]);
    await client.query('COMMIT');

    // Online payment integration is intentionally disabled for now. This creates an
    // order request only; payment remains pending until the store confirms arrangements.
    res.status(201).json({success:true,orderReference:orderRef,total,paymentStatus:'pending',message:'Your order request has been received. The store will contact you to arrange payment and delivery.'});
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    if (orderRef) await releaseInventory(orderRef, 'payment_unavailable').catch(()=>{});
    if (error.status) return res.status(error.status).json({success:false,message:error.message});
    console.error('Checkout failed:',error.message);
    res.status(500).json({success:false,message:'We could not create your order. Please try again.'});
  } finally { client.release(); }
});

async function releaseInventory(orderRef) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT items,inventory_released,payment_status FROM orders WHERE order_reference=$1 FOR UPDATE',[orderRef]);
    if (!result.rows[0] || result.rows[0].inventory_released || result.rows[0].payment_status === 'paid') { await client.query('COMMIT'); return; }
    for (const item of result.rows[0].items) await client.query('UPDATE products SET stock=stock+$1,updated_at=NOW() WHERE id=$2',[Number(item.quantity)||0,item.id]);
    await client.query("UPDATE orders SET inventory_released=TRUE,payment_status='failed',order_status='cancelled',updated_at=NOW() WHERE order_reference=$1",[orderRef]);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; } finally { client.release(); }
}

app.get('/api/orders/:reference', async (req, res) => {
  const email = text(req.query.email,255).toLowerCase();
  if (!email) return res.status(400).json({success:false,message:'Order email is required.'});
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_reference=$1 AND LOWER(customer_email)=$2',[text(req.params.reference,80),email]);
    if (!rows[0]) return res.status(404).json({success:false,message:'Order not found. Check the reference and email address.'});
    res.json({success:true,order:orderFromRow(rows[0])});
  } catch(error) { console.error(error.message); res.status(500).json({success:false,message:'Could not retrieve order.'}); }
});
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300'); res.json({success:true,orders:rows.map(orderFromRow)}); }
  catch(error) { console.error(error.message); res.status(500).json({success:false,message:'Could not load orders.'}); }
});
app.patch('/api/admin/orders/:reference', requireAdmin, async (req, res) => {
  const allowed = ['awaiting_payment','received','processing','shipped','delivered','cancelled'];
  const status = text(req.body?.status,30);
  if (!allowed.includes(status)) return res.status(400).json({success:false,message:'Invalid order status.'});
  try {
    const orderRef = text(req.params.reference,80);
    if (status === 'cancelled') await releaseInventory(orderRef);
    else {
      const { rows } = await pool.query('UPDATE orders SET order_status=$1,updated_at=NOW() WHERE order_reference=$2 RETURNING *',[status,orderRef]);
      if (!rows[0]) return res.status(404).json({success:false,message:'Order not found.'});
      return res.json({success:true,order:orderFromRow(rows[0])});
    }
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_reference=$1',[orderRef]);
    if (!rows[0]) return res.status(404).json({success:false,message:'Order not found.'});
    res.json({success:true,order:orderFromRow(rows[0])});
  } catch(error){ console.error(error.message); res.status(500).json({success:false,message:'Could not update order.'}); }
});

// Serve the existing static storefront after API routes.
app.use((req, res, next) => {
  if (/^\/(server\.js|package(?:-lock)?\.json|README\.md|node_modules)(?:\/|$)/i.test(req.path)) return res.status(404).send('Not found');
  next();
});
app.use(express.static(__dirname, { dotfiles: 'ignore', index: 'index.html' }));
app.use('/api', (req,res)=>res.status(404).json({success:false,message:'API endpoint not found.'}));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));

setupDatabase().then(() => {
  app.listen(PORT, () => console.log(`EFESSA RT server running on port ${PORT}`));
}).catch(error => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
