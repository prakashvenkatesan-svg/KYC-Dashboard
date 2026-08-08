document.addEventListener('DOMContentLoaded', async () => {
  const userStr = localStorage.getItem('kyc_user');
  const user = JSON.parse(userStr || '{}');
  
  if (user.role !== 'Admin') {
    document.querySelector('.table-container').innerHTML = '<h2>Access Denied. Admin only.</h2>';
    return;
  }

  const tbody = document.getElementById('users-tbody');
  const modal = document.getElementById('user-modal');
  const userForm = document.getElementById('user-form');
  const addUserBtn = document.getElementById('add-user-btn');
  const closeBtns = document.querySelectorAll('.close-modal');
  
  let currentUsers = [];

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      if (data && data.success) {
        currentUsers = data.data;
        renderUsers(currentUsers);
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Failed to load users: ${data?.message || 'Unknown error'}</td></tr>`;
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Network error loading users</td></tr>`;
    }
  };

  const renderUsers = (users) => {
    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No users found</td></tr>`;
      return;
    }
    
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const mods = u.assigned_modules ? (typeof u.assigned_modules === 'string' ? JSON.parse(u.assigned_modules) : u.assigned_modules).join(', ') : '';
      tr.innerHTML = `
        <td><strong>${u.full_name}</strong><br><small>${u.email_id}</small></td>
        <td>${u.username}</td>
        <td><span class="status-badge ${u.role === 'Admin' ? 'status-success' : 'status-pending'}">${u.role}</span></td>
        <td><span class="status-badge ${u.account_status === 'Active' ? 'status-success' : 'status-rejected'}">${u.account_status}</span></td>
        <td style="font-size: 0.8em; max-width: 200px;">${mods}</td>
        <td>${u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
        <td class="action-links">
          <a class="edit-user" data-id="${u.id}">Edit</a>
          <a class="delete-user" data-id="${u.id}">Delete</a>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.edit-user').forEach(btn => btn.addEventListener('click', handleEditClick));
    document.querySelectorAll('.delete-user').forEach(btn => btn.addEventListener('click', handleDeleteClick));
  };

  const openModal = (isEdit, userData = null) => {
    userForm.reset();
    document.getElementById('modal-title').textContent = isEdit ? 'Edit User' : 'Create New User';
    document.getElementById('pwd-hint').style.display = isEdit ? 'inline' : 'none';
    document.getElementById('password').required = !isEdit;
    
    if (isEdit && userData) {
      document.getElementById('user-id').value = userData.id;
      document.getElementById('full-name').value = userData.full_name;
      document.getElementById('username').value = userData.username;
      document.getElementById('username').disabled = true; // prevent changing username
      document.getElementById('email-id').value = userData.email_id;
      document.getElementById('mobile-number').value = userData.mobile_number || '';
      document.getElementById('role').value = userData.role;
      document.getElementById('account-status').value = userData.account_status;
      
      const mods = typeof userData.assigned_modules === 'string' ? JSON.parse(userData.assigned_modules) : userData.assigned_modules;
      if (Array.isArray(mods)) {
        document.querySelectorAll('input[name="modules"]').forEach(cb => {
          cb.checked = mods.includes(cb.value);
        });
      }
    } else {
      document.getElementById('user-id').value = '';
      document.getElementById('username').disabled = false;
    }
    
    modal.style.display = 'flex';
  };

  const closeModal = () => {
    modal.style.display = 'none';
  };

  closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
  addUserBtn.addEventListener('click', () => openModal(false));

  const handleEditClick = (e) => {
    const id = parseInt(e.target.dataset.id);
    const userToEdit = currentUsers.find(u => u.id === id);
    if (userToEdit) openModal(true, userToEdit);
  };

  const handleDeleteClick = async (e) => {
    const id = parseInt(e.target.dataset.id);
    if (id === user.userId || id === user.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      try {
        const res = await api.delete('/users/' + id);
        if (res.success) {
          loadUsers();
        } else {
          alert('Delete failed: ' + res.message);
        }
      } catch (err) {
        alert('Error deleting user');
      }
    }
  };

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('user-id').value;
    const isEdit = !!id;
    
    const selectedMods = Array.from(document.querySelectorAll('input[name="modules"]:checked')).map(cb => cb.value);
    
    const payload = {
      full_name: document.getElementById('full-name').value,
      email_id: document.getElementById('email-id').value,
      mobile_number: document.getElementById('mobile-number').value,
      role: document.getElementById('role').value,
      account_status: document.getElementById('account-status').value,
      assigned_modules: selectedMods
    };

    const pwd = document.getElementById('password').value;
    if (pwd) payload.password = pwd;
    if (!isEdit) payload.username = document.getElementById('username').value;

    try {
      let res;
      if (isEdit) {
        res = await api.put('/users/' + id, payload);
      } else {
        res = await api.post('/users', payload);
      }
      
      if (res.success) {
        closeModal();
        loadUsers();
      } else {
        alert('Save failed: ' + res.message);
      }
    } catch (err) {
      alert('Error saving user');
    }
  });

  // Init
  loadUsers();
});
