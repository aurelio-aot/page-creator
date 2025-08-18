const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const sharp = require('sharp'); // Add sharp for image resizing
const { TwitterApi } = require('twitter-api-v2');

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

// Add Twitter API configuration
const twitterClient = new TwitterApi({
  appKey: '8jZxaKvfd2TGszp8BoXWlmtWg',
  appSecret: 'YiwsjiA1kx5wrIDCvUImuNvIBfVCwBs8LgspoYafSTqSAauEnY',
  accessToken: '1917355129352904704-hmKac4Hl3xMfsYEcBgUr0e9unJ6cMa',
  accessSecret: 'vcij54cyrPV2yW5OMOw6izIn5ISi6VYy7LPS2rB2qyUwb',
});

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

// Add file filter to only allow specific image types
const fileFilter = (req, file, cb) => {
  // Check file types
  if (file.mimetype === 'image/png' || 
      file.mimetype === 'image/jpg' || 
      file.mimetype === 'image/jpeg' || 
      file.mimetype === 'image/gif') {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG and GIF file formats are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB file size limit
  }
});

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
  const publicToken = req.query.public;
  if (publicToken === 'true') {
    return next(); // Allow access with the token
  }

  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Add a new route for Twitter API sharing
app.post('/api/share-twitter', requireAuth, async (req, res) => {
  try {
    const { text, url } = req.body;
    
    if (!text || !url) {
      return res.status(400).json({ error: 'Text and URL are required' });
    }
    
    // Create a tweet with the provided text and URL
    const { data } = await twitterClient.v2.tweet(`${text}\n\n${url}`);
    
    return res.json({
      success: true,
      tweetId: data.id,
      message: 'Tweet posted successfully!'
    });
  } catch (error) {
    console.error('Twitter API error:', error);
    
    // Return appropriate error message
    return res.status(500).json({
      success: false,
      error: error.message || 'Error posting to Twitter'
    });
  }
});

// Update the meta tags section in server.js
app.get('/page/:slug', (req, res) => {
  const pages = JSON.parse(fs.readFileSync(pagesDbPath, 'utf8'));
  const page = pages.find(p => {
    const pathSlug = p.url.replace('/page/', '');
    return pathSlug === req.params.slug;
  });
  
  if (!page) {
    return res.redirect('/'); // Redirect to homepage if page not found
  }
  
  // Create absolute URLs for image and page, ensuring the public parameter is included
  const imageUrl = page.cardImage ? 
    `${req.protocol}://${req.get('host')}${page.cardImage}` : '';
  const pageUrl = `${req.protocol}://${req.get('host')}${page.url}?public=true`;
  
  // Render HTML with improved meta tags
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${page.title}</title>
      
      <!-- Twitter Card Meta Tags -->
      <meta name="twitter:card" content="${page.cardType}" />
      <meta property="og:url" content="${pageUrl}" />
      <meta name="twitter:title" content="${page.cardTitle || page.title}" />
      <meta name="twitter:description" content="${page.cardDescription || page.summary}" />
      ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
      
      <!-- Open Graph Meta Tags -->
      <meta property="og:title" content="${page.cardTitle || page.title}" />
      <meta property="og:description" content="${page.cardDescription || page.summary}" />
      <meta property="og:type" content="website" />
      ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
      
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div id="root"></div>
      <script>
        // Inject the current page data for React
        window.CURRENT_PAGE = ${JSON.stringify(page)};
        
        // Add the public flag for client-side use
        window.PUBLIC_ACCESS = ${req.query.public === 'true'};
      </script>
      <script src="/bundle.js"></script>
    </body>
    </html>
  `);
});

// Add a public route to get a specific page by slug - no auth required
app.get('/api/public/pages/:slug', (req, res) => {
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

// Updated image upload route with resizing
app.post('/api/upload-image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded or invalid file type. Only PNG, JPG and GIF formats are allowed.' });
    }
    
    // Get file info
    const imagePath = req.file.path;
    const filenameParts = req.file.filename.split('.');
    const fileExtension = filenameParts.pop().toLowerCase();
    const filenameWithoutExt = filenameParts.join('.');
    
    // Output path for resized image
    const outputPath = path.join(req.file.destination, `${filenameWithoutExt}-resized.${fileExtension}`);
    
    // Get image metadata to check dimensions
    const metadata = await sharp(imagePath).metadata();
    
    // Target dimensions for Twitter cards (2:1 ratio)
    const targetWidth = 1200;
    const targetHeight = 600;
    let needsResize = false;
    
    // Check if image needs resizing
    if (metadata.width > targetWidth || metadata.height > targetHeight) {
      needsResize = true;
      
      // Resize image while keeping aspect ratio
      await sharp(imagePath)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'inside'
        })
        .toFile(outputPath);
      
      // If original is not needed, remove it
      fs.unlinkSync(imagePath);
      
      // Use resized image path
      var imageUrl = `/uploads/${filenameWithoutExt}-resized.${fileExtension}`;
    } else {
      // Use original image path
      var imageUrl = `/uploads/${req.file.filename}`;
    }
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}`,
      resized: needsResize
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return res.status(500).json({ error: 'Error processing image' });
  }
});

// Error handler for multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 5MB.' 
      });
    }
    return res.status(400).json({ 
      error: `Upload error: ${err.message}` 
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({ 
      error: err.message 
    });
  }
  next();
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

// Modify the root handler to check for public access
app.get('*', (req, res) => {
  // If this is a public page access, allow it
  if (req.query.public === 'true' && req.path.startsWith('/page/')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  
  // Otherwise serve the React app for all other routes
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});