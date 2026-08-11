import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    full_name: '',
    username: '',
    email_id: '',
    mobile_number: '',
    role: 'Staff',
    account_status: 'Active',
    assigned_modules: [],
    password: ''
  });

  const availableModules = [
    { value: 'all', label: 'All Modules' },
    { value: 'upload_clients', label: 'Upload Clients' },
    { value: 'dashboard', label: 'Dashboard' }
  ];

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('kyc_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        setIsAdmin(user.role === 'Admin');
      }
    } catch (e) {}
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.success) {
        setUsers(res.data || []);
      } else {
        setError(res.message || 'Failed to load users');
      }
    } catch (err) {
      setError('Network error loading users');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenModal = (userToEdit = null) => {
    if (userToEdit) {
      setIsEditing(true);
      let parsedModules = [];
      try {
        parsedModules = typeof userToEdit.assigned_modules === 'string' 
          ? JSON.parse(userToEdit.assigned_modules) 
          : (userToEdit.assigned_modules || []);
      } catch (e) { }

      setFormData({
        id: userToEdit.id,
        full_name: userToEdit.full_name || '',
        username: userToEdit.username || '',
        email_id: userToEdit.email_id || '',
        mobile_number: userToEdit.mobile_number || '',
        role: userToEdit.role || 'Staff',
        account_status: userToEdit.account_status || 'Active',
        assigned_modules: Array.isArray(parsedModules) ? parsedModules : [],
        password: '' // empty for edit
      });
    } else {
      setIsEditing(false);
      setFormData({
        id: '',
        full_name: '',
        username: '',
        email_id: '',
        mobile_number: '',
        role: 'Staff',
        account_status: 'Active',
        assigned_modules: [],
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleModuleChange = (value) => {
    setFormData(prev => {
      const mods = [...prev.assigned_modules];
      if (mods.includes(value)) {
        return { ...prev, assigned_modules: mods.filter(m => m !== value) };
      } else {
        return { ...prev, assigned_modules: [...mods, value] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      full_name: formData.full_name,
      email_id: formData.email_id,
      mobile_number: formData.mobile_number,
      role: formData.role,
      account_status: formData.account_status,
      assigned_modules: formData.assigned_modules
    };

    if (formData.password) payload.password = formData.password;
    if (!isEditing) payload.username = formData.username;

    try {
      let res;
      if (isEditing) {
        res = await api.put(`/users/${formData.id}`, payload);
      } else {
        res = await api.post('/users', payload);
      }
      
      if (res.success) {
        handleCloseModal();
        loadUsers();
      } else {
        alert('Save failed: ' + res.message);
      }
    } catch (err) {
      alert('Error saving user');
    }
  };

  const handleDelete = async (user) => {
    if (user.id === currentUser?.userId || user.id === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${user.full_name}? This cannot be undone.`)) {
      try {
        const res = await api.delete(`/users/${user.id}`);
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

  if (!isAdmin) return <div style={{ padding: 20 }}><h2>Access Denied. Admin only.</h2></div>;

  return (
    <div className="table-container" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>User Management</h1>
        <button onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
          + Create New User
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="table-wrapper" style={{ overflowX: 'auto', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-color)' }}>
            <tr>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>User</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Username</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Role</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Modules</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Last Login</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No users found</td></tr>
            ) : (
              users.map(u => {
                let mods = [];
                try {
                  mods = typeof u.assigned_modules === 'string' ? JSON.parse(u.assigned_modules) : (u.assigned_modules || []);
                } catch(e) {}
                
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 12 }}>
                      <strong>{u.full_name}</strong><br/>
                      <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{u.email_id}</span>
                    </td>
                    <td style={{ padding: 12 }}>{u.username}</td>
                    <td style={{ padding: 12 }}>
                      <span className={`status-badge ${u.role === 'Admin' ? 'status-success' : 'status-pending'}`}>{u.role}</span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span className={`status-badge ${u.account_status === 'Active' ? 'status-success' : 'status-rejected'}`}>{u.account_status}</span>
                    </td>
                    <td style={{ padding: 12, fontSize: '0.85em', maxWidth: 200 }}>{Array.isArray(mods) ? mods.join(', ') : ''}</td>
                    <td style={{ padding: 12 }}>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                    <td style={{ padding: 12, display: 'flex', gap: 12 }}>
                      <button onClick={() => handleOpenModal(u)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      <button onClick={() => handleDelete(u)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', zIndex: 2000, left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '8px', width: '600px', maxWidth: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ margin: 0 }}>{isEditing ? 'Edit User' : 'Create New User'}</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Full Name *</label>
                    <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Username *</label>
                    <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required disabled={isEditing} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', opacity: isEditing ? 0.6 : 1 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Email ID *</label>
                    <input type="email" value={formData.email_id} onChange={e => setFormData({...formData, email_id: e.target.value})} required style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Mobile Number</label>
                    <input type="text" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Role</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
                      <option value="Staff">Staff</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>Account Status</label>
                    <select value={formData.account_status} onChange={e => setFormData({...formData, account_status: e.target.value})} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.9rem' }}>
                    Password {isEditing ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8em', fontWeight: 'normal' }}>(Leave blank to keep current)</span> : '*'}
                  </label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!isEditing} minLength="6" style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ marginBottom: 8, fontWeight: 500, fontSize: '0.9rem' }}>Assigned Modules</label>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {availableModules.map(mod => (
                      <label key={mod.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          value={mod.value} 
                          checked={formData.assigned_modules.includes(mod.value)} 
                          onChange={() => handleModuleChange(mod.value)} 
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{mod.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                  <button type="button" onClick={handleCloseModal} style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--surface-hover)', cursor: 'pointer', fontWeight: 600, color: 'var(--text-color)' }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{isEditing ? 'Update User' : 'Create User'}</button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
