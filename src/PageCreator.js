import { useState, useEffect } from 'react';
import { Trash2, Plus, Eye, Save, X, Copy, Check, Link, Layout, FileText, AlertTriangle, Twitter, Share2 } from 'lucide-react';

// API base URL - change this to your server URL
const API_BASE_URL = '';  // Empty string means same domain as the app

export default function PageCreator({ isPublicMode = false }) {
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isPublicView, setIsPublicView] = useState(isPublicMode);
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    cardType: 'summary',
    cardTitle: '',
    cardDescription: '',
    cardImage: null,
    cardImagePreview: null
  });
  const [imageError, setImageError] = useState(null);
  const [isApiLoading, setIsApiLoading] = useState(false);

  // Load pages from the server and check for current page in URL
  useEffect(() => {
    // Update public view state based on props or window.PUBLIC_ACCESS
    setIsPublicView(isPublicMode || window.PUBLIC_ACCESS);
    
    // First check if we have a current page from server-side rendering
    if (window.CURRENT_PAGE) {
      setCurrentPage(window.CURRENT_PAGE);
    }
    
    // If in public mode and on a page URL, fetch just that page
    if ((isPublicMode || window.PUBLIC_ACCESS) && window.location.pathname.startsWith('/page/')) {
      const pageSlug = window.location.pathname.replace('/page/', '');
      fetchPublicPage(pageSlug);
    } else {
      // Otherwise fetch all pages as normal
      fetchPages();
    }
  }, [isPublicMode]);

  const fetchPages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/pages`);
      if (response.ok) {
        const data = await response.json();
        setPages(data);
        
        // Check if we should select a page based on URL
        if (!window.CURRENT_PAGE) {
          const pathname = window.location.pathname;
          if (pathname.startsWith('/page/')) {
            const pageSlug = pathname.replace('/page/', '');
            
            const matchingPage = data.find(page => {
              const pageUrlPath = page.url.replace('/page/', '');
              return pageUrlPath === pageSlug;
            });
            
            if (matchingPage) {
              setCurrentPage(matchingPage);
            } else if (data.length > 0) {
              setCurrentPage(data[0]);
            }
          } else if (data.length > 0 && !currentPage) {
            setCurrentPage(data[0]);
          }
        }
      } else {
        console.error("Error fetching pages:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch just one page for public viewing
  const fetchPublicPage = async (slug) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/public/pages/${slug}`);
      if (response.ok) {
        const page = await response.json();
        setCurrentPage(page);
      } else {
        console.error("Error fetching public page:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching public page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      const fileType = file.type;
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(fileType)) {
        setImageError("Only PNG, JPG and GIF formats are allowed.");
        alert("Invalid file type. Only PNG, JPG and GIF formats are allowed.");
        return;
      }
      
      // Check file size
      if (file.size > 1 * 1024 * 1024) {
        setImageError("Image is too large. Maximum size is 1MB.");
        alert("File too big. Please upload a file smaller than 1MB.");
        return;
      }
      
      const reader = new FileReader();
      
      // For preview
      reader.onload = (event) => {
        // Create an image element to check dimensions
        const img = new Image();
        img.onload = () => {
          // Twitter recommends 2:1 ratio for large card images
          // Minimum dimensions: 300x157
          const aspectRatio = img.width / img.height;
          
          if (img.width < 300 || img.height < 157) {
            setImageError("Image is too small. Twitter requires minimum dimensions of 300x157 pixels.");
            return;
          }
          
          // Warn if aspect ratio is significantly off from 2:1
          if (aspectRatio < 1.7 || aspectRatio > 2.3) {
            setImageError("Warning: For best Twitter card display, use an image with 2:1 aspect ratio (e.g., 1200x600 pixels). The image may be resized automatically.");
          } else {
            setImageError(null);
          }
          
          setFormData({
            ...formData,
            cardImagePreview: event.target.result
          });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
      
      // Upload the image to the server
      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            cardImage: data.imageUrl  // Store the relative URL returned by the server
          }));
          
          // If image was resized, inform the user
          if (data.resized) {
            setImageError("Your image has been automatically resized to fit Twitter card requirements (1200x600 pixels max).");
          }
        } else {
          const errorData = await response.json();
          console.error("Error uploading image:", errorData.error);
          setImageError(errorData.error || "Error uploading image. Please try again.");
        }
      } catch (error) {
        console.error("Error uploading image:", error);
        setImageError("Error uploading image. Please try again.");
      }
    }
  };

  const handleDeleteImage = () => {
    setFormData({
      ...formData,
      cardImage: null,
      cardImagePreview: null
    });
    setImageError(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          summary: formData.summary,
          cardType: formData.cardType,
          cardTitle: formData.cardTitle || formData.title,
          cardDescription: formData.cardDescription || formData.summary,
          cardImage: formData.cardImage
        })
      });
      
      if (response.ok) {
        const { page } = await response.json();
        
        // Update local state
        setPages([...pages, page]);
        setCurrentPage(page);
        setShowForm(false);
        
        // Reset form
        setFormData({
          title: '',
          summary: '',
          cardType: 'summary',
          cardTitle: '',
          cardDescription: '',
          cardImage: null,
          cardImagePreview: null
        });
        setImageError(null);
        
        // Update the browser URL to match the new page
        window.history.pushState({}, '', page.url);
      } else {
        console.error("Error creating page:", await response.text());
      }
    } catch (error) {
      console.error("Error creating page:", error);
    }
  };

  const handleDeletePage = async (pageId) => {
    // First confirm with the user
    setConfirmDelete(pageId);
  };

  const confirmDeletePage = async () => {
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/pages/${confirmDelete}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Update local state
        const newPages = pages.filter(page => page.id !== confirmDelete);
        setPages(newPages);
        
        // If we deleted the current page, select another one or show empty state
        if (currentPage && currentPage.id === confirmDelete) {
          if (newPages.length > 0) {
            setCurrentPage(newPages[0]);
            window.history.pushState({}, '', newPages[0].url);
          } else {
            setCurrentPage(null);
            window.history.pushState({}, '', '/');
          }
        }
        
        // Hide the confirmation dialog
        setConfirmDelete(null);
      } else {
        console.error("Error deleting page:", await response.text());
      }
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  const cancelDeletePage = () => {
    setConfirmDelete(null);
  };

  const handleViewPage = (page) => {
    setCurrentPage(page);
    setShowForm(false);
    
    // Update the browser URL when viewing a page
    window.history.pushState({}, '', page.url);
  };
  
  // Twitter sharing functionality
  const shareOnTwitter = (page) => {
    if (!page) return;
    
    // Create the full URL to share
    const pageUrl = `${window.location.origin}${page.url}?public=true`;
    
    // Create share text
    const shareText = encodeURIComponent(`${page.title}\n\n${pageUrl}`);
    
    // Open Twitter intent URL
    window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank');
  };
  
  // Improved copyPageUrl function with fallback mechanism
  const copyPageUrl = (url) => {
    // Add the public parameter to the URL
    const fullUrl = window.location.origin + url + '?public=true';
    
    // Try using the Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.warn('Clipboard API failed:', err);
          fallbackCopyTextToClipboard(fullUrl);
        });
    } else {
      // Fallback for browsers without clipboard API
      fallbackCopyTextToClipboard(fullUrl);
    }
  };

  // Add this function to your PageCreator component
const shareViaTwitterApi = async (page) => {
  if (!page) return;
  
  try {
    // Create the full URL to share
    const pageUrl = `${window.location.origin}${page.url}?public=true`;
    
    // Create share text
    const shareText = page.title;
    
    // Show loading state
    setIsLoading(true);
    
    // Call your API endpoint
    const response = await fetch(`${API_BASE_URL}/api/share-twitter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: shareText,
        url: pageUrl
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('Successfully shared to Twitter!');
    } else {
      alert(`Error: ${data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error sharing via Twitter API:', error);
    alert('Failed to share to Twitter. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  // Fallback copy method using textarea element
  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    // Save current selection
    const selected = document.getSelection().rangeCount > 0 
      ? document.getSelection().getRangeAt(0) 
      : false;
    
    // Select the text field
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    let success = false;
    try {
      // Execute copy command
      success = document.execCommand('copy');
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.warn('Failed to copy with execCommand');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      // Show alternative message to user
      alert('Your browser doesn\'t support automatic copying. The URL is: ' + text);
    }
    
    // Remove the textarea
    document.body.removeChild(textArea);
    
    // Restore original selection if any
    if (selected) {
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(selected);
    }
  };

  // Public view component for a page
  const PublicPageView = ({ page }) => {
    if (!page) return <div className="loading">Loading page...</div>;
    
    return (
      <div className="public-page fade-in">
        <div className="card mb-6">
          <div className="card-body">
            <h1 className="text-2xl font-semibold mb-4">{page.title}</h1>
            <p className="mb-6">{page.summary}</p>
            
            {page.cardImage && (
              <div className="page-image-container mb-6">
                <img 
                  src={page.cardImage} 
                  alt={page.title}
                  className="page-image" 
                />
              </div>
            )}
            
            <div className="public-page-footer mt-6">
              <Twitter size={20} className="twitter-icon" />
              <p className="text-sm">
                Shared via Twitter
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Twitter card preview component
  const TwitterCardPreview = ({ type, title, description, image, host }) => {
    return (
      <div className="twitter-card">
        {type === 'summary_large_image' && (
          <div className="twitter-card-image">
            {image ? (
              <img 
                src={image} 
                alt="Card preview" 
                className="twitter-card-img"
              />
            ) : (
              <div className="twitter-card-image-placeholder">
                No image uploaded
              </div>
            )}
          </div>
        )}
        <div className="twitter-card-content">
          <div className="twitter-card-title">
            {title || 'Card Title'}
          </div>
          <div className="twitter-card-description">
            {description || 'Card description will appear here'}
          </div>
          <div className="twitter-card-url">
            <Link size={14} className="twitter-card-link-icon" />
            {host}
          </div>
        </div>
      </div>
    );
  };

  // If this is a public view from Twitter, show only the page content
  if (isPublicView) {
    return (
      <div className="public-view-container">
        <PublicPageView page={currentPage} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Layout size={20} />
            Page Creator
          </div>
        </div>
        
        <div className="sidebar-content">
          <button 
            className="btn btn-primary w-full mb-6"
            onClick={() => {
              setShowForm(true);
              setCurrentPage(null);
              setImageError(null);
              // Reset URL when creating a new page
              window.history.pushState({}, '', '/');
            }}
          >
            <Plus size={16} />
            Add New Page
          </button>
          
          <div className="sidebar-section-title">
            Pages
          </div>
          
          {isLoading ? (
            <div className="text-center mt-4 text-gray-500">Loading pages...</div>
          ) : (
            <ul className="page-list">
              {pages.map(page => (
                <li key={page.id} className="page-item">
                  <div className={`page-card ${currentPage?.id === page.id ? 'active' : ''}`}>
                    <div className="page-card-header">
                      <div className="flex justify-between items-center">
                        <button 
                          onClick={() => handleViewPage(page)}
                          className="page-card-title"
                        >
                          {page.title}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePage(page.id);
                          }}
                          className="delete-btn"
                          title="Delete page"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="page-card-footer">
                      <div className="page-url">
                        <Link size={12} />
                        <div className="page-url-text">
                          {window.location.origin}{page.url}?public=true
                        </div>
                      </div>
                      <button
                        onClick={() => copyPageUrl(page.url)}
                        className="url-copy-btn"
                        title="Copy URL"
                      >
                        {copied && currentPage?.id === page.id ? 
                          <Check size={14} className="text-success" /> : 
                          <Copy size={14} />
                        }
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {showForm ? (
          <div className="card fade-in">
            <div className="card-header">
              <h2 className="font-semibold text-xl">Create New Page</h2>
              <button 
                onClick={() => setShowForm(false)}
                className="btn-icon"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="title">
                  Page Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="form-control"
                  maxLength={70}
                />
                {formData.title.length > 60 && (
                  <div className="text-sm text-warning mt-1">
                    Twitter recommends titles under 70 characters.
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="summary">
                  Page Summary
                </label>
                <textarea
                  id="summary"
                  name="summary"
                  value={formData.summary}
                  onChange={handleInputChange}
                  rows="3"
                  className="form-control"
                  maxLength={200}
                />
                {formData.summary.length > 180 && (
                  <div className="text-sm text-warning mt-1">
                    Twitter recommends descriptions under 200 characters.
                  </div>
                )}
              </div>
              
              <div className="form-divider">
                <h3 className="form-section-title">
                  <Layout size={18} />
                  X Card Configuration
                </h3>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="cardType">
                    Card Type
                  </label>
                  <select
                    id="cardType"
                    name="cardType"
                    value={formData.cardType}
                    onChange={handleInputChange}
                    className="form-control form-select"
                  >
                    <option value="summary">Summary</option>
                    <option value="summary_large_image">Summary with Large Image</option>
                  </select>
                  <div className="text-sm text-gray-500 mt-1">
                    {formData.cardType === 'summary' ? 
                      'Summary cards include a small square image, title and description.' :
                      'Large image cards include a prominent image above the title and description.'}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="cardTitle">
                    Card Title
                  </label>
                  <input
                    type="text"
                    id="cardTitle"
                    name="cardTitle"
                    value={formData.cardTitle}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder={formData.title || "Leave blank to use page title"}
                    maxLength={70}
                  />
                  {formData.cardTitle && formData.cardTitle.length > 60 && (
                    <div className="text-sm text-warning mt-1">
                      Twitter recommends titles under 70 characters.
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="cardDescription">
                    Card Description
                  </label>
                  <textarea
                    id="cardDescription"
                    name="cardDescription"
                    value={formData.cardDescription}
                    onChange={handleInputChange}
                    rows="2"
                    className="form-control"
                    placeholder={formData.summary || "Leave blank to use page summary"}
                    maxLength={200}
                  />
                  {formData.cardDescription && formData.cardDescription.length > 180 && (
                    <div className="text-sm text-warning mt-1">
                      Twitter recommends descriptions under 200 characters.
                    </div>
                  )}
                </div>
                
                {formData.cardType === 'summary_large_image' && (
                  <div className="form-group">
                    <label className="form-label">
                      Card Image
                    </label>
                    
                    {formData.cardImagePreview ? (
                      <div>
                        <div className="image-preview-container">
                          <img 
                            src={formData.cardImagePreview} 
                            alt="Preview" 
                            className="image-preview"
                            style={{ objectFit: 'cover', aspectRatio: '2/1' }}
                          />
                          <button
                            type="button"
                            onClick={handleDeleteImage}
                            className="image-delete-btn"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        {imageError && (
                          <div className="image-error-message">
                            <AlertTriangle size={14} />
                            <span>{imageError}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id="cardImage"
                          accept="image/png, image/jpeg, image/jpg, image/gif"
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                        />
                        <label
                          htmlFor="cardImage"
                          className="image-upload-placeholder"
                        >
                          <div className="flex flex-col items-center">
                            <Plus size={24} className="image-upload-icon" />
                            <span className="image-upload-text">Upload image</span>
                            <span className="text-sm text-gray-500 mt-2">
                              Recommended: 1200×600 pixels (2:1 ratio)
                            </span>
                            <span className="text-xs text-gray-500 mt-1">
                              Allowed formats: PNG, JPG, GIF
                            </span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="preview-section">
                  <h4 className="preview-header">
                    <Eye size={16} />
                    Preview
                  </h4>
                  
                  <div className="preview-container">
                    <TwitterCardPreview 
                      type={formData.cardType}
                      title={formData.cardTitle || formData.title || 'Card Title'}
                      description={formData.cardDescription || formData.summary || 'Card description will appear here'}
                      image={formData.cardImagePreview}
                      host={window.location.host}
                    />
                    
                    <div className="twitter-card-tips">
                      <h5 className="twitter-card-tips-title">Twitter Card Tips:</h5>
                      <ul className="twitter-card-tips-list">
                        <li>Images for large cards should have a 2:1 aspect ratio (e.g., 1200×600px)</li>
                        <li>Keep titles under 70 characters</li>
                        <li>Keep descriptions under 200 characters</li>
                        <li>Image must be under 5MB</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card-footer">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn btn-primary"
                disabled={!formData.title}
              >
                <Save size={16} />
                Save Page
              </button>
            </div>
          </div>
        ) : currentPage ? (
          <div className="fade-in">
            <div className="card mb-6">
              <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                  <h1 className="text-2xl font-semibold">{currentPage.title}</h1>
                  <div className="flex gap-2">
                    
                    <button
                      onClick={() => shareOnTwitter(currentPage)}
                      className="btn btn-primary btn-sm"
                    >
                      <Twitter size={16} />
                      Share on Twitter
                    </button>
                    
                    <button
                        onClick={() => shareViaTwitterApi(currentPage)}
                        className="btn btn-twitter btn-sm"
                        disabled={isLoading}
                      >
                        <Twitter size={16} />
                        Share thru Twitter API
                      </button>
                    <button
                      onClick={() => copyPageUrl(currentPage.url)}
                      className="btn btn-outline btn-sm"
                    >
                      <Copy size={16} />
                      Copy URL
                    </button>
                    <button
                      onClick={() => handleDeletePage(currentPage.id)}
                      className="btn btn-danger btn-sm"
                    >
                      <Trash2 size={16} />
                      Delete Page
                    </button>
                  </div>
                </div>
                <p className="mb-6">{currentPage.summary}</p>
                
                <div className="code-block mb-6">
<pre>
{`<!-- X Card Metadata (automatically included in the page head) -->
<meta name="twitter:card" content="${currentPage.cardType}" />
<meta property="og:url" content="${window.location.origin}${currentPage.url}?public=true" />
<meta name="twitter:title" content="${currentPage.cardTitle || currentPage.title}" />
<meta name="twitter:description" content="${currentPage.cardDescription || currentPage.summary}" />${currentPage.cardImage ? `
<meta name="twitter:image" content="${window.location.origin}${currentPage.cardImage}" />` : ''}`}
</pre>
                </div>
                
                <div className="form-divider">
                  <h3 className="form-section-title">
                    <Eye size={18} />
                    X Card Preview
                  </h3>
                  
                  <div className="preview-container">
                    <TwitterCardPreview 
                      type={currentPage.cardType}
                      title={currentPage.cardTitle || currentPage.title}
                      description={currentPage.cardDescription || currentPage.summary}
                      image={currentPage.cardImage}
                      host={window.location.host}
                    />
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-primary-ultralight rounded-lg">
                  <div className="text-sm font-medium">
                    <p>✓ This page is now ready for sharing on X/Twitter!</p>
                    <p className="mt-2">When you share this URL: <span className="font-semibold">{window.location.origin}{currentPage.url}?public=true</span></p>
                    <p className="mt-2">X/Twitter will automatically generate a card with your title, description, and image (if added).</p>
                    <p className="public-url-notice">Note: The ?public=true parameter allows anyone to view this page without login when clicked from Twitter.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state fade-in">
            <FileText size={48} className="text-gray-500 mb-4" />
            <h2 className="empty-state-title">No page selected</h2>
            <p className="empty-state-description">Select a page from the sidebar or create a new one</p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary mt-4"
            >
              <Plus size={16} />
              Add New Page
            </button>
          </div>
        )}
        
        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">Delete Page</h3>
                <button 
                  onClick={cancelDeletePage}
                  className="modal-close-btn"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this page?</p>
                <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button
                  onClick={cancelDeletePage}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePage}
                  className="btn btn-danger"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}