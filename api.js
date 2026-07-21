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
    const userProfileContainers = document.querySelectorAll('.user-profile');
    
    if (userProfileContainers.length > 0) {
      const initials = user.full_name.substring(0, 2).toUpperCase();
      const isAdmin = user.role === 'Admin';
      
      const profileHTML = `
        <div class="profile-menu" id="profile-menu-toggle">
          <div class="profile-avatar">${initials}</div>
          <div class="profile-info">
            <span class="profile-name">${user.full_name}</span>
            <span class="profile-role">${user.role}</span>
          </div>
          <span class="dropdown-arrow">▼</span>
          
          <div class="profile-dropdown" id="profile-dropdown">
            <a href="#" class="dropdown-item" id="menu-my-profile">My Profile</a>
            ${isAdmin ? `<a href="#" class="dropdown-item" id="menu-edit-profile">Edit Profile</a>` : ''}
            <a href="#" class="dropdown-item" id="menu-change-password">Change Password</a>
            <a href="#" class="dropdown-item" id="menu-login-activity">Login Activity</a>
            <a href="#" class="dropdown-item" id="menu-logout" style="color: #F87171;">Logout</a>
          </div>
        </div>
      `;
      
      userProfileContainers.forEach(container => {
        container.innerHTML = profileHTML;
        // Strip out the inline flex styles applied in HTML since we have CSS now
        container.style = ""; 
      });

      // Dropdown toggle
      const menuToggle = document.getElementById('profile-menu-toggle');
      const dropdown = document.getElementById('profile-dropdown');
      
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        menuToggle.classList.toggle('open');
      });
      
      document.addEventListener('click', () => {
        dropdown.classList.remove('show');
        menuToggle.classList.remove('open');
      });

      // Actions
      document.getElementById('menu-logout').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('kyc_auth_token');
        localStorage.removeItem('kyc_user');
        window.location.href = 'login.html';
      });

      // Inject Modal HTML into body if not exists
      if (!document.getElementById('profile-modal')) {
        const modalHTML = `
          <div id="profile-modal" class="modal" style="display: none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); align-items: center; justify-content: center;">
            <div class="modal-content" style="background-color: var(--surface-color); border-radius: 8px; width: 500px; max-width: 90%; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
              <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <h2 id="profile-modal-title" style="margin: 0; font-size: 1.2rem;">My Profile</h2>
                <button class="close-profile-modal" style="cursor: pointer; font-size: 1.5rem; color: var(--text-muted); border: none; background: transparent;">&times;</button>
              </div>
              <div id="profile-modal-body" style="line-height: 1.6; font-size: 0.95rem;">
                <!-- Content -->
              </div>
            </div>
          </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
      }

      const profileModal = document.getElementById('profile-modal');
      const profileModalBody = document.getElementById('profile-modal-body');
      const profileModalTitle = document.getElementById('profile-modal-title');
      const closeBtns = document.querySelectorAll('.close-profile-modal');
      
      closeBtns.forEach(btn => {
        btn.addEventListener('click', () => { profileModal.style.display = 'none'; });
      });

      document.getElementById('menu-my-profile').addEventListener('click', (e) => {
        e.preventDefault();
        profileModalTitle.textContent = "My Profile";
        
        let modulesText = 'None';
        try {
          const mods = typeof user.assigned_modules === 'string' ? JSON.parse(user.assigned_modules) : user.assigned_modules;
          if (Array.isArray(mods) && mods.length) modulesText = mods.join(', ');
        } catch (e) {}

        profileModalBody.innerHTML = `
          <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 24px;">
            <div class="profile-avatar" style="width:64px; height:64px; font-size: 1.5rem;">${initials}</div>
            <div>
              <div style="font-size: 1.2rem; font-weight: 600;">${user.full_name}</div>
              <div style="color: var(--text-secondary);">${user.username}</div>
            </div>
          </div>
          <div class="detail-grid" style="margin-top: 0;">
            <div class="detail-row"><span class="label">Email ID</span><span class="value">${user.email_id || 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Mobile Number</span><span class="value">${user.mobile_number || 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Role</span><span class="value">${user.role}</span></div>
            <div class="detail-row"><span class="label">Account Status</span><span class="value">${user.account_status || 'Active'}</span></div>
            <div class="detail-row"><span class="label">Modules</span><span class="value" style="font-size: 0.8rem;">${modulesText}</span></div>
          </div>
        `;
        profileModal.style.display = 'flex';
      });

      document.getElementById('menu-login-activity').addEventListener('click', (e) => {
        e.preventDefault();
        profileModalTitle.textContent = "Login Activity";
        const d = new Date(user.last_login);
        const lastLogin = user.last_login ? d.toLocaleString() : 'N/A';
        profileModalBody.innerHTML = `
          <p><strong>Last successful login:</strong></p>
          <p>${lastLogin}</p>
        `;
        profileModal.style.display = 'flex';
      });

      if (isAdmin) {
        document.getElementById('menu-edit-profile').addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = 'users.html';
        });
      }

      document.getElementById('menu-change-password').addEventListener('click', (e) => {
        e.preventDefault();
        profileModalTitle.textContent = "Change Password";
        profileModalBody.innerHTML = `
          <form id="change-pwd-form" style="display:flex; flex-direction: column; gap: 16px;">
            <div>
              <label style="display:block; margin-bottom: 8px;">New Password</label>
              <input type="password" id="new-pwd" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.2); color: white;">
            </div>
            <div id="pwd-msg" style="color: var(--success-color); display: none;"></div>
            <button type="submit" style="background: var(--primary-color); color: white; padding: 10px; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">Update Password</button>
          </form>
        `;
        profileModal.style.display = 'flex';
        
        document.getElementById('change-pwd-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const pwd = document.getElementById('new-pwd').value;
          try {
            const res = await api.put('/profile', { password: pwd });
            if (res.success) {
              document.getElementById('pwd-msg').textContent = "Password updated successfully!";
              document.getElementById('pwd-msg').style.display = "block";
              setTimeout(() => { profileModal.style.display = 'none'; }, 2000);
            } else {
              document.getElementById('pwd-msg').textContent = res.message;
              document.getElementById('pwd-msg').style.color = "var(--rejected-color)";
              document.getElementById('pwd-msg').style.display = "block";
            }
          } catch(err) {
            document.getElementById('pwd-msg').textContent = "Failed to update password.";
            document.getElementById('pwd-msg').style.color = "var(--rejected-color)";
            document.getElementById('pwd-msg').style.display = "block";
          }
        });
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
