const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kalyan2025';

// Setup EJS
app.set('view engine', 'ejs');

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware to serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../html'))); // Serve HTML files
app.use('/admin', express.static(path.join(__dirname, '../admin'))); // Serve admin panel

// Ensure 'uploads' folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure Multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

// Simple session store (in production, use Redis or database)
const sessions = new Map();

// Generate session token
function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const session = sessions.get(token);
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
}

// Routes

// Admin login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateSessionToken();
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    sessions.set(token, { expires, username });
    
    res.json({ 
      success: true, 
      token,
      message: 'Login successful' 
    });
  } else {
    res.status(401).json({ 
      error: 'Invalid credentials' 
    });
  }
});

// Admin logout endpoint
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    sessions.delete(token);
  }
  res.json({ message: 'Logged out successfully' });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !sessions.has(token)) {
    return res.json({ authenticated: false });
  }
  
  const session = sessions.get(token);
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return res.json({ authenticated: false });
  }
  
  res.json({ authenticated: true, username: session.username });
});

// Show upload form
app.get('/upload', (req, res) => {
  res.render('upload');
});

// Handle upload (protected route)
app.post('/upload', requireAuth, upload.single('photo'), (req, res) => {
  res.json({ success: true, message: 'Image uploaded successfully' });
});

// Show gallery
app.get('/gallery', (req, res) => {
  fs.readdir('uploads', (err, files) => {
    if (err) return res.send('Error reading images');
    res.render('gallery', { images: files });
  });
});

// API endpoint to get gallery images as JSON
app.get('/api/gallery', (req, res) => {
  fs.readdir('uploads', (err, files) => {
    if (err) return res.status(500).json({ error: 'Error reading images' });
    
    // Filter only image files
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
    
    res.json({ images: imageFiles });
  });
});

// Serve team.html page
app.get('/team', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/team.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// API endpoint to delete an image (protected route)
app.delete('/api/delete/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return res.status(500).json({ error: 'Failed to delete image' });
    }
    res.json({ message: 'Image deleted successfully' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
