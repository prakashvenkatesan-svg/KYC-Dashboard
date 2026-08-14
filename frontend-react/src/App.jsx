import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Payments from './pages/Payments';
import Beta from './pages/Beta';
import Trash from './pages/Trash';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Legacy Vanilla HTML Redirects */}
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        <Route path="/index.html" element={<Navigate to="/dashboard" replace />} />
        <Route path="/clients.html" element={<Navigate to="/clients" replace />} />
        <Route path="/payments.html" element={<Navigate to="/payments" replace />} />
        <Route path="/beta.html" element={<Navigate to="/beta" replace />} />
        

        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="beta" element={<Beta />} />
          <Route path="trash" element={<Trash />} />
          <Route path="users" element={<Users />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
