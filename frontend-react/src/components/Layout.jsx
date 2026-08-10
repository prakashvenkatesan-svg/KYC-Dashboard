import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Loading...');

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

  const handleLogout = () => {
    localStorage.removeItem('kyc_user');
    localStorage.removeItem('kyc_token');
    navigate('/login');
  };

  const toggleTheme = () => {
    const body = document.body;
    body.classList.toggle('light-mode');
  };

  return (
    <div className="layout">
      <div id="sidebar-container">
        <Sidebar />
      </div>
      <main className="main-content">
        <header className="top-header">
          <h1 id="page-title">KYC Dashboard</h1>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button id="theme-toggle" className="theme-toggle" type="button" onClick={toggleTheme}>Toggle Mode</button>
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
