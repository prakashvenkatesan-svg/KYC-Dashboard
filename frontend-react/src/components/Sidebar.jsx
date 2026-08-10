import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import cvlLogo from '../../public/cvlkra-logo.png';
import cdslLogo from '../../public/cdsl-logo.png';
import nseLogo from '../../public/nse-logo.png';
import bseLogo from '../../public/bse-logo.png';
import techexcelLogo from '../../public/techexcel-logo.png';

export default function Sidebar() {
  const [kycOpen, setKycOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleKycStatus = (status) => {
    navigate(`/clients?kyc_status=${status}`);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '24px 16px 16px' }} onClick={() => navigate('/dashboard')}>
        <img src="/logo.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%' }} />
        <div>
          <h2 style={{ marginBottom: '2px' }}>AIONION Capital</h2>
          <p style={{ margin: '0' }}>KYC Operations</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="nav-link">
          <i className="icon">&#128202;</i> Dashboard
        </NavLink>
        <NavLink to="/clients" className="nav-link" end>
          <i className="icon">&#128101;</i> Clients
        </NavLink>
        <NavLink to="/payments" className="nav-link">
          <i className="icon" style={{ fontStyle: 'normal' }}>&#128179;</i> Payments
        </NavLink>

        {/* KYC Status Menu */}
        <div className={`status-parent ${kycOpen || location.search.includes('kyc_status') ? 'open' : ''}`}>
          <div className="nav-link status-toggle" onClick={() => setKycOpen(!kycOpen)}>
            <i className="icon" style={{ fontStyle: 'normal' }}>&#9989;</i> <span>KYC Status</span>
            <span className="dropdown-arrow">&#8250;</span>
          </div>
          <div className="status-submenu" style={{ display: kycOpen ? 'block' : 'none' }}>
            <div className="nav-link status-sub-link" onClick={() => handleKycStatus('in_progress')}>In Progress</div>
            <div className="nav-link status-sub-link" onClick={() => handleKycStatus('completed')}>Completed</div>
          </div>
        </div>

        {/* Integrations Menu */}
        <div className={`integration-parent ${integrationsOpen ? 'open' : ''}`}>
          <div className="nav-link integration-toggle" onClick={() => setIntegrationsOpen(!integrationsOpen)}>
            <i className="icon" style={{ fontStyle: 'normal' }}>&#128279;</i> <span>Integrations</span>
            <span className="dropdown-arrow">&#8250;</span>
          </div>
          <div className="integration-submenu" style={{ display: integrationsOpen ? 'block' : 'none' }}>
            <NavLink to="/clients?integration=cvlkra" className="nav-link integration-sub-link">
              <img src="/cvlkra-logo.png" className="icon" style={{ width: '20px', height: '20px', objectFit: 'contain', marginRight: '12px', borderRadius: '4px', background: 'white', padding: '2px' }} /> CVL KRA
            </NavLink>
            <NavLink to="/clients?integration=cdsl" className="nav-link integration-sub-link">
              <img src="/cdsl-logo.png" className="icon" style={{ width: '20px', height: '20px', objectFit: 'contain', marginRight: '12px', borderRadius: '4px', background: 'white', padding: '2px' }} /> CDSL
            </NavLink>
            <NavLink to="/clients?integration=nse" className="nav-link integration-sub-link">
              <img src="/nse-logo.png" className="icon" style={{ width: '20px', height: '20px', objectFit: 'contain', marginRight: '12px', borderRadius: '4px', background: 'white', padding: '2px' }} /> NSE
            </NavLink>
            <NavLink to="/clients?integration=bse" className="nav-link integration-sub-link">
              <img src="/bse-logo.png" className="icon" style={{ width: '20px', height: '20px', objectFit: 'contain', marginRight: '12px', borderRadius: '4px', background: 'white', padding: '2px' }} /> BSE
            </NavLink>
            <NavLink to="/clients?integration=techexcel" className="nav-link integration-sub-link">
              <img src="/techexcel-logo.png" className="icon" style={{ width: '20px', height: '20px', objectFit: 'contain', marginRight: '12px', borderRadius: '4px', background: 'white', padding: '2px' }} /> TechExcel
            </NavLink>
          </div>
        </div>

        <NavLink to="/users" className="nav-link">
          <i className="icon" style={{ fontStyle: 'normal' }}>&#9881;</i> User Management
        </NavLink>
        
        <NavLink to="/audit-logs" className="nav-link">
          <i className="icon" style={{ fontStyle: 'normal' }}>&#128220;</i> Audit Logs
        </NavLink>

        <NavLink to="/trash" className="nav-link">
          <i className="icon" style={{ fontStyle: 'normal' }}>&#128465;</i> Trash
        </NavLink>
      </nav>
    </aside>
  );
}
