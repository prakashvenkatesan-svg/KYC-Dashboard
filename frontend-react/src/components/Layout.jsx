import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('Loading...');
  const [theme, setTheme] = useState(localStorage.getItem('kyc_dashboard_theme') || 'dark');

  useEffect(() => {
    // Basic auth check placeholder - you will replace this with real logic
    const userStr = localStorage.getItem('kyc_user');
    if (!userStr) {
      navigate('/login');
    } else {
      try {
        const user = JSON.parse(userStr);
        setUserName(user.full_name || user.username || 'User');
      } catch(e) {
        navigate('/login');
      }
    }
  }, [navigate]);

  useEffect(() => {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-mode', isLight);
    localStorage.setItem('kyc_dashboard_theme', theme);
  }, [theme]);

  const handleLogout = () => {
    localStorage.removeItem('kyc_user');
    localStorage.removeItem('kyc_token');
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const isClientDetail = location.pathname.match(/^\/clients\/[^\/]+$/);

  const handleBack = () => {
    if (window.hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to go back?")) {
        return;
      }
    }
    window.hasUnsavedChanges = false;
    navigate('/clients');
  };

  return (
    <div className="layout">
      <div id="sidebar-container">
        <Sidebar />
      </div>
      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isClientDetail && (
              <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back
              </button>
            )}
            <h1 id="page-title">KYC Dashboard</h1>
          </div>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button id="theme-toggle" className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            <span id="logged-in-user">{userName}</span>
            <button id="logout-btn" onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>Logout</button>
          </div>
        </header>
        
        <div className="dashboard-content">
          {/* This is where the specific page content renders */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
