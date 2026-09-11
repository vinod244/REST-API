import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fullstack_super_secret_jwt_key_2026';

// CORS configuration - Allow all origins in production or frontend URL
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000']
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Database connection setup
const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;

if (DATABASE_URL) {
  console.log('🔗 Connecting to hosted PostgreSQL database...');
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });
} else {
  console.log('⚠️ No DATABASE_URL specified. Running with fallback local storage.');
}

// In-memory / local JSON store fallback if PostgreSQL is not attached locally
const LOCAL_DATA_FILE = path.join(__dirname, 'data', 'products.json');
const LOCAL_USERS_FILE = path.join(__dirname, 'data', 'users.json');

function ensureLocalFiles() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocal(filePath) {
  ensureLocalFiles();
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeLocal(filePath, data) {
  ensureLocalFiles();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Initial Sample Products
const INITIAL_PRODUCTS = [
  {
    id: 'prod-1001',
    name: 'Wireless Noise-Canceling Headphones',
    category: 'Electronics',
    price: 199.99,
    stock: 15,
    status: 'In Stock',
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    description: 'High-fidelity audio with active noise cancellation and 30-hour battery life.',
    sku: 'SKU-HEAD-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-1002',
    name: 'Mechanical Gaming Keyboard',
    category: 'Electronics',
    price: 89.50,
    stock: 4,
    status: 'Low Stock',
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
    description: 'RGB backlit mechanical keyboard with tactile blue switches.',
    sku: 'SKU-KEYS-02',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-1003',
    name: 'Ergonomic Office Chair',
    category: 'Furniture',
    price: 249.00,
    stock: 0,
    status: 'Out of Stock',
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1580481072645-022f9a6d8310?auto=format&fit=crop&w=600&q=80',
    description: 'Breathable mesh back with adjustable lumbar support and armrests.',
    sku: 'SKU-CHAIR-03',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-1004',
    name: 'Stainless Steel Water Bottle',
    category: 'Fitness',
    price: 24.99,
    stock: 50,
    status: 'In Stock',
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
    description: 'Double-wall vacuum insulated water bottle keeps drinks cold for 24 hours.',
    sku: 'SKU-BOTTLE-04',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Database Schema Initialization
async function initDb() {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          stock INT NOT NULL,
          status VARCHAR(50) NOT NULL,
          rating NUMERIC(3, 1) DEFAULT 5.0,
          image_url TEXT,
          description TEXT,
          sku VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const res = await pool.query('SELECT COUNT(*) FROM products');
      if (parseInt(res.rows[0].count, 10) === 0) {
        console.log('🌱 Seeding initial PostgreSQL products...');
        for (const p of INITIAL_PRODUCTS) {
          await pool.query(
            `INSERT INTO products (id, name, category, price, stock, status, rating, image_url, description, sku, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [p.id, p.name, p.category, p.price, p.stock, p.status, p.rating, p.imageUrl, p.description, p.sku, p.createdAt, p.updatedAt]
          );
        }
      }
      console.log('✅ PostgreSQL database tables ready.');
    } catch (err) {
      console.error('❌ Error initializing PostgreSQL tables:', err);
    }
  } else {
    // Seed local JSON file if empty
    const localProds = readLocal(LOCAL_DATA_FILE);
    if (localProds.length === 0) {
      writeLocal(LOCAL_DATA_FILE, INITIAL_PRODUCTS);
    }
  }
}

initDb();

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Helper to Map DB Product Row to JSON Object
function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: parseFloat(row.price),
    stock: parseInt(row.stock, 10),
    status: row.status,
    rating: parseFloat(row.rating || 5.0),
    imageUrl: row.image_url || row.imageUrl,
    description: row.description,
    sku: row.sku,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

// ---------------- API ROUTES ----------------

// Health Check
app.get('/api/health', async (req, res) => {
  let dbStatus = pool ? 'connected' : 'local-json';
  if (pool) {
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      dbStatus = 'error: ' + err.message;
    }
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// AUTH: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    if (pool) {
      const existing = await pool.query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const result = await pool.query(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
        [name.trim(), trimmedEmail, hashedPassword]
      );
      const newUser = result.rows[0];
      const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email }
      });
    } else {
      const users = readLocal(LOCAL_USERS_FILE);
      if (users.find(u => u.email === trimmedEmail)) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      const newUser = {
        id: users.length + 1,
        name: name.trim(),
        email: trimmedEmail,
        password: hashedPassword,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      writeLocal(LOCAL_USERS_FILE, users);

      const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email }
      });
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// AUTH: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    let user = null;
    if (pool) {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      user = result.rows[0];
    } else {
      const users = readLocal(LOCAL_USERS_FILE);
      user = users.find(u => u.email === trimmedEmail);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// AUTH: Get Current User
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ user: result.rows[0] });
    } else {
      const users = readLocal(LOCAL_USERS_FILE);
      const user = users.find(u => u.id === req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: { id: user.id, name: user.name, email: user.email } });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// STATS: Get Dashboard Stats
app.get('/api/stats', async (req, res) => {
  try {
    let products = [];
    if (pool) {
      const result = await pool.query('SELECT * FROM products');
      products = result.rows.map(formatProduct);
    } else {
      products = readLocal(LOCAL_DATA_FILE);
    }

    const totalProducts = products.length;
    const categories = [...new Set(products.map(p => p.category))];
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;
    const totalInventoryValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);

    res.json({
      totalProducts,
      totalCategories: categories.length,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
      categories
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to compute dashboard stats' });
  }
});

// PRODUCTS: Get Products List (Search, Filter, Sort)
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, status, sortBy, order } = req.query;

    let products = [];
    if (pool) {
      let queryStr = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (search) {
        params.push(`%${search.trim().toLowerCase()}%`);
        queryStr += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR LOWER(sku) LIKE $${params.length})`;
      }

      if (category && category !== 'All') {
        params.push(category.trim().toLowerCase());
        queryStr += ` AND LOWER(category) = $${params.length}`;
      }

      if (status && status !== 'All') {
        params.push(status.trim().toLowerCase());
        queryStr += ` AND LOWER(status) = $${params.length}`;
      }

      const sortCol = sortBy === 'price' ? 'price' : sortBy === 'stock' ? 'stock' : sortBy === 'name' ? 'name' : 'created_at';
      const sortDir = order === 'asc' ? 'ASC' : 'DESC';
      queryStr += ` ORDER BY ${sortCol} ${sortDir}`;

      const result = await pool.query(queryStr, params);
      products = result.rows.map(formatProduct);
    } else {
      products = readLocal(LOCAL_DATA_FILE);

      if (search) {
        const q = search.toLowerCase().trim();
        products = products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }

      if (category && category !== 'All') {
        products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }

      if (status && status !== 'All') {
        products = products.filter(p => p.status.toLowerCase() === status.toLowerCase());
      }

      if (sortBy) {
        const isDesc = order === 'desc';
        products.sort((a, b) => {
          let valA = a[sortBy];
          let valB = b[sortBy];
          if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
          }
          if (valA < valB) return isDesc ? 1 : -1;
          if (valA > valB) return isDesc ? -1 : 1;
          return 0;
        });
      } else {
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    }

    res.json(products);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// PRODUCTS: Get Single Product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json(formatProduct(result.rows[0]));
    } else {
      const products = readLocal(LOCAL_DATA_FILE);
      const product = products.find(p => p.id === req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      return res.json(product);
    }
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving product detail' });
  }
});

// PRODUCTS: Create Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price, stock, description, imageUrl, sku, status } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
    if (!category || !category.trim()) return res.status(400).json({ error: 'Category is required' });
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Valid positive price is required' });
    }
    if (stock === undefined || isNaN(Number(stock)) || Number(stock) < 0) {
      return res.status(400).json({ error: 'Valid non-negative stock quantity is required' });
    }

    const numStock = parseInt(stock, 10);
    const numPrice = parseFloat(Number(price).toFixed(2));
    const derivedStatus = status || (numStock === 0 ? 'Out of Stock' : numStock <= 5 ? 'Low Stock' : 'In Stock');
    const newId = `prod-${Date.now().toString().slice(-6)}`;
    const finalImage = imageUrl?.trim() || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80';
    const finalSku = sku ? sku.toUpperCase().trim() : `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalDesc = description ? description.trim() : 'No description provided.';
    const now = new Date().toISOString();

    const newProduct = {
      id: newId,
      name: name.trim(),
      category: category.trim(),
      price: numPrice,
      stock: numStock,
      status: derivedStatus,
      rating: 5.0,
      imageUrl: finalImage,
      description: finalDesc,
      sku: finalSku,
      createdAt: now,
      updatedAt: now
    };

    if (pool) {
      await pool.query(
        `INSERT INTO products (id, name, category, price, stock, status, rating, image_url, description, sku, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [newProduct.id, newProduct.name, newProduct.category, newProduct.price, newProduct.stock, newProduct.status, newProduct.rating, newProduct.imageUrl, newProduct.description, newProduct.sku, newProduct.createdAt, newProduct.updatedAt]
      );
    } else {
      const products = readLocal(LOCAL_DATA_FILE);
      products.unshift(newProduct);
      writeLocal(LOCAL_DATA_FILE, products);
    }

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PRODUCTS: Update Product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, category, price, stock, description, imageUrl, sku, status } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Valid positive price is required' });
    }

    const numStock = parseInt(stock, 10);
    const numPrice = parseFloat(Number(price).toFixed(2));
    const derivedStatus = status || (numStock === 0 ? 'Out of Stock' : numStock <= 5 ? 'Low Stock' : 'In Stock');
    const now = new Date().toISOString();

    if (pool) {
      const check = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

      const existing = check.rows[0];
      const updated = {
        name: name.trim(),
        category: category ? category.trim() : existing.category,
        price: numPrice,
        stock: numStock,
        status: derivedStatus,
        imageUrl: imageUrl ? imageUrl.trim() : existing.image_url,
        description: description ? description.trim() : existing.description,
        sku: sku ? sku.toUpperCase().trim() : existing.sku,
        updatedAt: now
      };

      await pool.query(
        `UPDATE products SET name=$1, category=$2, price=$3, stock=$4, status=$5, image_url=$6, description=$7, sku=$8, updated_at=$9 WHERE id=$10`,
        [updated.name, updated.category, updated.price, updated.stock, updated.status, updated.imageUrl, updated.description, updated.sku, updated.updatedAt, req.params.id]
      );

      return res.json({ id: req.params.id, ...updated, rating: parseFloat(existing.rating), createdAt: existing.created_at });
    } else {
      const products = readLocal(LOCAL_DATA_FILE);
      const index = products.findIndex(p => p.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Product not found' });

      const updatedProduct = {
        ...products[index],
        name: name.trim(),
        category: category ? category.trim() : products[index].category,
        price: numPrice,
        stock: numStock,
        status: derivedStatus,
        imageUrl: imageUrl ? imageUrl.trim() : products[index].imageUrl,
        description: description ? description.trim() : products[index].description,
        sku: sku ? sku.toUpperCase().trim() : products[index].sku,
        updatedAt: now
      };

      products[index] = updatedProduct;
      writeLocal(LOCAL_DATA_FILE, products);
      return res.json(updatedProduct);
    }
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// PRODUCTS: Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    if (pool) {
      const check = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

      await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
      return res.json({ message: 'Product deleted successfully', id: req.params.id });
    } else {
      const products = readLocal(LOCAL_DATA_FILE);
      const index = products.findIndex(p => p.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Product not found' });

      const deleted = products.splice(index, 1)[0];
      writeLocal(LOCAL_DATA_FILE, products);
      return res.json({ message: 'Product deleted successfully', id: deleted.id });
    }
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 REST API Backend running on port ${PORT}`);
});
