import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (localStorage.getItem('kyc_auth_token') && localStorage.getItem('kyc_user')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const data = await api.post('/login', { username: username.trim(), password: password.trim() });
      
      if (data.success && data.token) {
        localStorage.setItem('kyc_auth_token', data.token);
        if (data.user) {
          localStorage.setItem('kyc_user', JSON.stringify(data.user));
        }
        navigate('/dashboard');
      } else {
        const detail = data.error ? ` (${data.error})` : '';
        setErrorMsg((data.message || 'Invalid credentials') + detail);
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100vw;
          background-color: var(--bg-color);
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
        }
        .login-container {
          background-color: var(--surface-color);
          padding: 40px;
          border-radius: 12px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--surface-border);
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .brand {
          text-align: center;
          margin-bottom: 30px;
        }
        .brand h1 {
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 5px;
        }
        .brand p {
          color: var(--primary-color);
          font-weight: 500;
          font-size: 0.95rem;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .form-group input {
          width: 100%;
          padding: 12px 15px;
          border-radius: 8px;
          border: 1px solid var(--surface-border);
          background-color: var(--input-bg);
          color: var(--text-primary);
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
        }
        .login-btn {
          width: 100%;
          padding: 12px;
          background-color: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-btn:hover {
          background-color: var(--primary-hover);
        }
        .login-btn:disabled {
          background-color: var(--text-secondary);
          cursor: not-allowed;
        }
        .error-msg {
          color: var(--rejected-color);
          font-size: 0.9rem;
          text-align: center;
          margin-top: 15px;
          min-height: 20px;
        }
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="login-page-wrapper">
        <div className="login-container">
          <div className="brand">
            <h1>AIONION Capital</h1>
            <p>KYC Operations Dashboard</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input 
                type="text" 
                id="username" 
                name="username" 
                placeholder="Enter your username" 
                required 
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                placeholder="Enter your password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <button type="submit" className="login-btn" disabled={loading || !username || !password}>
              {loading ? <div className="loading-spinner"></div> : <span>Sign In</span>}
            </button>

            {errorMsg && <div className="error-msg">{errorMsg}</div>}
          </form>
        </div>
      </div>
    </>
  );
}
