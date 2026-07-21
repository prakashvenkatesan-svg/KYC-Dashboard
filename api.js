const API_BASE_URL = 'https://xvbefkfln5.execute-api.ap-south-1.amazonaws.com/admin/kyc-dashboard';

// We use the local storage key defined in our new auth flow
const getAuthHeaders = () => {
  const token = localStorage.getItem('kyc_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Global Auth Check & Logout setup
const initAuth = () => {
  const token = localStorage.getItem('kyc_auth_token');
  const userStr = localStorage.getItem('kyc_user');
  
  if (!token || !userStr) {
    if (window.location.pathname.includes('login.html')) return;
    
    // Redirect to login page if not logged in
    window.location.href = 'login.html';
  } else {
    // Populate user UI if elements exist
    const user = JSON.parse(userStr);
    const loggedInEl = document.getElementById('logged-in-user');
    if (loggedInEl) {
      loggedInEl.textContent = `${user.full_name} (${user.role})`;
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('kyc_auth_token');
        localStorage.removeItem('kyc_user');
        location.reload();
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', initAuth);

const api = {
  getDashboardSummary: async () => {
    const res = await fetch(`${API_BASE_URL}/summary`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },
  getClients: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/clients?${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch clients');
    return res.json();
  },
  getClientByCode: async (clientCode) => {
    const res = await fetch(`${API_BASE_URL}/clients/${clientCode}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch client detail');
    return res.json();
  },
  getIntegrationRecords: async (integrationName, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/integrations/${integrationName}?${qs}`, { headers: getAuthHeaders() });
    if (!res.ok && res.status !== 401 && res.status !== 403) throw new Error('Failed to fetch integration records');
    return res.json();
  },
  
  // Generic methods for User Management (and others)
  get: async (path) => {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: getAuthHeaders() });
    return res.json();
  },
  post: async (path, data) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },
  put: async (path, data) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },
  delete: async (path) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  }
};

window.api = api;
