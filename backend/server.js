// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'file_organizer',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    // Create default collection
    await pool.query(
      'INSERT INTO collections (user_id, name) VALUES (?, ?)',
      [result.insertId, 'Personal']
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: result.insertId, name, email }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const [users] = await pool.query(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ COLLECTIONS ROUTES ============

// Get all collections
app.get('/api/collections', authenticateToken, async (req, res) => {
  try {
    const [collections] = await pool.query(
      'SELECT id, name FROM collections WHERE user_id = ? ORDER BY name',
      [req.user.id]
    );
    res.json(collections);
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create collection
app.post('/api/collections', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Collection name required' });
    }

    const [result] = await pool.query(
      'INSERT INTO collections (user_id, name) VALUES (?, ?)',
      [req.user.id, name]
    );

    res.status(201).json({ id: result.insertId, name });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ TAGS ROUTES ============

// Get all tags
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    const [tags] = await pool.query(
      'SELECT id, name FROM tags WHERE user_id = ? ORDER BY name',
      [req.user.id]
    );
    res.json(tags);
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create tag
app.post('/api/tags', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tag name required' });
    }

    // Check if tag exists
    const [existing] = await pool.query(
      'SELECT id FROM tags WHERE user_id = ? AND name = ?',
      [req.user.id, name]
    );

    if (existing.length > 0) {
      return res.json({ id: existing[0].id, name });
    }

    const [result] = await pool.query(
      'INSERT INTO tags (user_id, name) VALUES (?, ?)',
      [req.user.id, name]
    );

    res.status(201).json({ id: result.insertId, name });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ITEMS ROUTES ============

// Get all items with search and filters
app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const { search, collection, tags } = req.query;
    
    let query = `
      SELECT 
        i.id, i.name, i.type, i.content, i.url, i.file_path, i.size, i.created_at,
        c.name as collection_name,
        GROUP_CONCAT(t.name) as tags
      FROM items i
      LEFT JOIN collections c ON i.collection_id = c.id
      LEFT JOIN item_tags it ON i.id = it.item_id
      LEFT JOIN tags t ON it.tag_id = t.id
      WHERE i.user_id = ?
    `;
    
    const params = [req.user.id];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (collection) {
      query += ' AND c.name = ?';
      params.push(collection);
    }

    query += ' GROUP BY i.id ORDER BY i.created_at DESC';

    const [items] = await pool.query(query, params);

    // Format items
    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      content: item.content,
      url: item.url,
      filePath: item.file_path,
      size: item.size,
      collection: item.collection_name,
      tags: item.tags ? item.tags.split(',') : [],
      createdAt: item.created_at
    }));

    // Filter by tags if provided
    let filteredItems = formattedItems;
    if (tags) {
      const tagArray = tags.split(',');
      filteredItems = formattedItems.filter(item =>
        tagArray.every(tag => item.tags.includes(tag))
      );
    }

    res.json(filteredItems);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create text item or link
app.post('/api/items', authenticateToken, async (req, res) => {
  try {
    const { name, type, content, url, collectionName, tags } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type required' });
    }

    // Get or create collection
    let collectionId;
    if (collectionName) {
      const [collections] = await pool.query(
        'SELECT id FROM collections WHERE user_id = ? AND name = ?',
        [req.user.id, collectionName]
      );

      if (collections.length > 0) {
        collectionId = collections[0].id;
      } else {
        const [result] = await pool.query(
          'INSERT INTO collections (user_id, name) VALUES (?, ?)',
          [req.user.id, collectionName]
        );
        collectionId = result.insertId;
      }
    }

    // Insert item
    const [result] = await pool.query(
      'INSERT INTO items (user_id, name, type, content, url, collection_id, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, type, content || null, url || null, collectionId, type === 'text' ? `${(content?.length || 0)} bytes` : '-']
    );

    const itemId = result.insertId;

    // Add tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Get or create tag
        let tagId;
        const [existingTags] = await pool.query(
          'SELECT id FROM tags WHERE user_id = ? AND name = ?',
          [req.user.id, tagName]
        );

        if (existingTags.length > 0) {
          tagId = existingTags[0].id;
        } else {
          const [tagResult] = await pool.query(
            'INSERT INTO tags (user_id, name) VALUES (?, ?)',
            [req.user.id, tagName]
          );
          tagId = tagResult.insertId;
        }

        // Link tag to item
        await pool.query(
          'INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)',
          [itemId, tagId]
        );
      }
    }

    res.status(201).json({
      id: itemId,
      name,
      type,
      content,
      url,
      collection: collectionName,
      tags
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload file
app.post('/api/items/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { collectionName, tags } = req.body;
    const name = req.file.originalname;
    const filePath = req.file.path;
    const size = `${(req.file.size / 1024 / 1024).toFixed(2)} MB`;

    // Get or create collection
    let collectionId;
    if (collectionName) {
      const [collections] = await pool.query(
        'SELECT id FROM collections WHERE user_id = ? AND name = ?',
        [req.user.id, collectionName]
      );

      if (collections.length > 0) {
        collectionId = collections[0].id;
      } else {
        const [result] = await pool.query(
          'INSERT INTO collections (user_id, name) VALUES (?, ?)',
          [req.user.id, collectionName]
        );
        collectionId = result.insertId;
      }
    }

    // Insert item
    const [result] = await pool.query(
      'INSERT INTO items (user_id, name, type, file_path, collection_id, size) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name, 'file', filePath, collectionId, size]
    );

    const itemId = result.insertId;

    // Add tags
    if (tags) {
      const tagArray = JSON.parse(tags);
      for (const tagName of tagArray) {
        let tagId;
        const [existingTags] = await pool.query(
          'SELECT id FROM tags WHERE user_id = ? AND name = ?',
          [req.user.id, tagName]
        );

        if (existingTags.length > 0) {
          tagId = existingTags[0].id;
        } else {
          const [tagResult] = await pool.query(
            'INSERT INTO tags (user_id, name) VALUES (?, ?)',
            [req.user.id, tagName]
          );
          tagId = tagResult.insertId;
        }

        await pool.query(
          'INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)',
          [itemId, tagId]
        );
      }
    }

    res.status(201).json({
      id: itemId,
      name,
      type: 'file',
      filePath,
      size,
      collection: collectionName,
      tags: tags ? JSON.parse(tags) : []
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete item
app.delete('/api/items/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;

    // Get item to check ownership and delete file if exists
    const [items] = await pool.query(
      'SELECT file_path FROM items WHERE id = ? AND user_id = ?',
      [itemId, req.user.id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete file if exists
    if (items[0].file_path) {
      try {
        fs.unlinkSync(items[0].file_path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    // Delete item_tags
    await pool.query('DELETE FROM item_tags WHERE item_id = ?', [itemId]);

    // Delete item
    await pool.query('DELETE FROM items WHERE id = ?', [itemId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download file
app.get('/api/items/:id/download', authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.query(
      'SELECT name, file_path FROM items WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (items.length === 0 || !items[0].file_path) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(items[0].file_path, items[0].name);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
