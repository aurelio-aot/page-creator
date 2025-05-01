import { useState, useEffect } from 'react';
import PageCreator from './PageCreator';
import Login from './Login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublicAccess, setIsPublicAccess] = useState(false);
  
  // Check authentication status on load
  useEffect(() => {
    // First check if this is a public page access
    const urlParams = new URLSearchParams(window.location.search);
    const isPublic = urlParams.get('public') === 'true' || window.PUBLIC_ACCESS;
    setIsPublicAccess(isPublic);
    
    // If it's a public page access, skip authentication check
    if (isPublic) {
      setIsLoading(false);
      return;
    }
    
    // Otherwise check authentication status
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        setIsAuthenticated(data.authenticated);
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);
  
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  // If this is a public page access or the user is authenticated, show the PageCreator
  if (isPublicAccess || isAuthenticated) {
    return (
      <div className="app-container">
        {/* Only show logout button if authenticated (not in public mode) */}
        {isAuthenticated && (
          <div className="logout-button">
            <button onClick={handleLogout} className="btn btn-sm btn-outline">
              Logout
            </button>
          </div>
        )}
        <PageCreator isPublicMode={isPublicAccess} />
      </div>
    );
  }
  
  // Otherwise show login
  return <Login onLoginSuccess={handleLoginSuccess} />;
}