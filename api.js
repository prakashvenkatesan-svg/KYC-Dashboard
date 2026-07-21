const API_BASE_URL = 'https://xvbefkfln5.execute-api.ap-south-1.amazonaws.com/admin/kyc-dashboard';

// We assume there's a global token or cookie for auth since it's an admin panel.
// We'll simulate sending an authorization header if a token is in localStorage.
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

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
    if (!res.ok) throw new Error('Failed to fetch integration records');
    return res.json();
  }
};

window.api = api;
