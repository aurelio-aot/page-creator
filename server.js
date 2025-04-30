const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add session middleware
app.use(session({
  secret: 'page-creator-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 hour
}));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: timestamp + original name
    const uniqueFilename = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, uniqueFilename);
  }
});

const upload = multer({ storage: storage });

// Initialize pages DB (using a JSON file for simplicity)
const pagesDbPath = path.join(__dirname, 'pages.json');
if (!fs.existsSync(pagesDbPath)) {
  fs.writeFileSync(pagesDbPath, JSON.stringify([]));
}

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Hardcoded credentials as requested
  if (username === 'admin' && password === 'admin123') {
    // Set user in session
    req.session.user = { username };
    return res.json({ success: true });
  }
  
  return res.status(401).json({ 
    success: false, 
    error: 'Invalid username or password' 
  });
});

// Check auth status route
app.get('/api/auth-status', (req, res) => {
  if (req.session.user) {
    return res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  }
  
  return res.json({ authenticated: false });
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Authentication middleware for protected routes
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Public routes (don't require authentication)
// Serve page HTML with proper meta tags for social sharing
app.get('/page/:slug', (req, res) => {
  const pages = JSON.parse(fs.readFileSync(pagesDbPath, 'utf8'));
  const page = pages.find(p => {
    const pathSlug = p.url.replace('/page/', '');
    return pathSlug === req.params.slug;
  });
  
  if (!page) {
    return res.redirect('/'); // Redirect to homepage if page not found
  }
  
  // Create absolute URL for image
  const imageUrl = page.cardImage ? 
    `${req.protocol}://${req.get('host')}${page.cardImage}` : '';
  
  // Render HTML with meta tags
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  
  <!-- X/Twitter Card Meta Tags -->
  <meta name="twitter:card" content="${page.cardType}" />
  <meta name="twitter:title" content="${page.cardTitle || page.title}" />
  <meta name="twitter:description" content="${page.cardDescription || page.summary}" />
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${page.cardTitle || page.title}" />
  <meta property="og:description" content="${page.cardDescription || page.summary}" />
  <meta property="og:type" content="website" />
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
  <meta property="og:url" content="${req.protocol}://${req.get('host')}${page.url}" />
  
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="root"></div>
  <script>
    // Inject the current page data for React
    window.CURRENT_PAGE = ${JSON.stringify(page)};
  </script>
  <script src="/bundle.js"></script>
</body>
</html>
  `);
});

// Routes that require authentication
// 1. Upload image
app.post('/api/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  
  // Return the URL to access the image
  const imageUrl = `/uploads/${req.file.filename}`;
  
  res.json({ 
    success: true, 
    imageUrl: imageUrl,
    fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}` 
  });
});

// 2. Save page data
app.post('/api/pages', requireAuth, (req, res) => {
  const { title, summary, cardType, cardTitle, cardDescription, cardImage } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  // Create a slug from the title
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  const timestamp = Date.now();
  const pageSlug = `${slug}-${timestamp}`;
  const url = `/page/${pageSlug}`;
  
  const newPage = {
    id: timestamp.toString(),
    title,
    summary,
    cardType,
    cardTitle,
    cardDescription,
    cardImage,
    url,
    createdAt: new Date().toISOString()
  };
  
  // Read existing pages
  const pages = JSON.parse(fs.readFileSync(pagesDbPath, 'utf8'));
  
  // Add new page
  pages.push(newPage);
  
  // Save back to file
  fs.writeFileSync(pagesDbPath, JSON.stringify(pages, null, 2));
  
  res.json({ success: true, page: newPage });
});

// 3. Get all pages
app.get('/api/pages', requireAuth, (req, res) => {
  const pages = JSON.parse(fs.readFileSync(pagesDbPath, 'utf8'));
  res.json(pages);
});

// 4. Get page by slug
app.get('/api/pages/:slug', requireAuth, (req, res) => {
  const pages = JSON.parse(fs.readFileSync(pagesDbPath, 'utf8'));
  const page = pages.find(p => {
    const pathSlug = p.url.replace('/page/', '');
    return pathSlug === req.params.slug;
  });
  
  if (!page) {
    return res.status(404).json({ error: 'Page not found' });
  }
  
  res.json(page);
});

// 5. Delete a page by ID
app.delete('/api/pages/:id', requireAuth, (req, res) => {
  console.log('deleting page...');
  const pageId = req.params.id;
  
  // Read existing pages
  const pages = JSON.parse(fs.readFileSync(pagesDbPath, 'utf8'));
  
  // Find the page index
  const pageIndex = pages.findIndex(p => p.id === pageId);
  
  if (pageIndex === -1) {
    return res.status(404).json({ error: 'Page not found' });
  }
  
  // Remove the page
  pages.splice(pageIndex, 1);
  
  // Save back to file
  fs.writeFileSync(pagesDbPath, JSON.stringify(pages, null, 2));
  
  res.json({ success: true });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});