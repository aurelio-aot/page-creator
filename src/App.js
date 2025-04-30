import { useState, useEffect } from 'react';
import PageCreator from './PageCreator';
import Login from './Login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check authentication status on load
  useEffect(() => {
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
  
  return (
    <>
      {isAuthenticated ? (
        <PageCreatorWithLogout onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

// Wrapper component to add logout functionality to PageCreator
function PageCreatorWithLogout({ onLogout }) {
  return (
    <div className="app-container">
      <div className="logout-button">
        <button onClick={onLogout} className="btn btn-sm btn-outline">
          Logout
        </button>
      </div>
      <PageCreator />
    </div>
  );
}