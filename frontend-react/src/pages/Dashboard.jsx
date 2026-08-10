import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-GB');
};

const getStatusClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'success' || value === 'all done') return 'success';
  if (value === 'uploaded') return 'uploaded';
  if (value === 'pending' || value.includes('missing') || value.includes('not pushed')) return 'pending';
  if (value === 'failed' || value.includes('failed') || value.includes('rejected')) return 'failed';
  return 'neutral';
};

const getLastMessage = (app) => {
  return app.cdsl_note
    || app.cdsl_msg_desc
    || app.nse_reason
    || app.bse_reason
    || app.cvlkra_reason
    || app.techexcel_reason
    || '';
};

export default function Dashboard() {
  const [report, setReport] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [reportError, setReportError] = useState(false);
  const [metricsError, setMetricsError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('kyc_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === 'Admin');
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    
    api.getPushOperationsReport()
      .then(response => {
        if (!response.success || response.forbidden) {
          setReportError(true);
        } else {
          setReport(response.data || { count: 0, allDoneCount: 0, pendingCount: 0, blockerCounts: {}, applications: [] });
        }
      })
      .catch(error => {
        console.error(error);
        setReportError(true);
      });
  }, [isAdmin]);

  useEffect(() => {
    api.getDashboardSummary()
      .then(response => {
        setMetrics(response.data);
      })
      .catch(error => {
        console.error(error);
        setMetricsError(true);
      });
  }, []);

  const renderPushKpis = () => {
    if (!report) return <div className="loading">Loading push report...</div>;

    const cdslAlreadyExistsCount = report.applications.filter((app) => app.cdsl_note).length;
    const failedCount = report.applications.filter((app) => {
      const blocker = String(app.current_blocker || '');
      return blocker !== 'All done' && (blocker.includes('failed') || blocker.includes('FAILED'));
    }).length;

    const cards = [
      { label: 'Completed eSign Live', value: report.count, tone: 'neutral' },
      { label: 'Fully Pushed', value: report.allDoneCount, tone: 'success' },
      { label: 'Pending Attention', value: report.pendingCount, tone: report.pendingCount ? 'pending' : 'success' },
      { label: 'Failed / Rejected', value: failedCount, tone: failedCount ? 'failed' : 'success' },
      { label: 'CDSL Already Exists', value: cdslAlreadyExistsCount, tone: 'uploaded' }
    ];

    return (
      <div id="push-kpi-container" className="push-kpi-grid">
        {cards.map((card, idx) => (
          <div key={idx} className={`push-kpi-card ${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  const renderBlockerSummary = () => {
    if (!report) return null;
    const entries = Object.entries(report.blockerCounts || {});
    if (!entries.length) {
      return (
        <div id="blocker-summary-container" className="blocker-summary">
          <div className="all-clear-message">No live completed eSign applications need attention.</div>
        </div>
      );
    }

    return (
      <div id="blocker-summary-container" className="blocker-summary">
        <h3>Blocker Summary</h3>
        <div className="blocker-chip-row">
          {entries.map(([label, count], idx) => (
            <span key={idx} className={`blocker-chip ${getStatusClass(label)}`}>
              {label}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderNeedsAttention = () => {
    if (!report) return <tr><td colSpan="9">Loading...</td></tr>;
    const pending = report.applications.filter((app) => app.current_blocker !== 'All done');
    if (!pending.length) {
      return <tr><td colSpan="9" className="empty-state">All live completed eSign applications are fully pushed.</td></tr>;
    }

    return pending.map((app, idx) => {
      const clientCode = app.cdsl_client_code || app.bse_client_code || app.techexcel_client_id || 'N/A';
      const message = getLastMessage(app);

      return (
        <tr key={idx}>
          <td><strong>{app.application_id}</strong></td>
          <td>{app.applicant_name || 'N/A'}</td>
          <td>{app.pan_number || 'N/A'}</td>
          <td>{clientCode}</td>
          <td>{app.bo_id || 'N/A'}</td>
          <td>
            <span className={`operation-status ${getStatusClass(app.current_blocker)}`}>
              {app.current_blocker}
            </span>
          </td>
          <td className="message-cell">{message || 'N/A'}</td>
          <td>{app.suggested_action || 'Review application'}</td>
          <td>{formatDateTime(app.last_updated)}</td>
        </tr>
      );
    });
  };

  const integrationsList = ['NSE', 'BSE', 'CVL KRA', 'CDSL', 'TechExcel'];

  return (
    <div className="dashboard-content">
      <p className="subtitle">Overview of external integration push statuses</p>

      {isAdmin && !reportError && (
        <section id="push-operations-section" className="push-operations-section">
          <div className="section-heading-row">
            <div>
              <h2>Push Operations</h2>
              <p>Live completed eSign applications only. Test entries are excluded.</p>
            </div>
            <span className="admin-only-badge">Admin Report</span>
          </div>

          {renderPushKpis()}
          {renderBlockerSummary()}

          <div className="needs-attention-panel">
            <div className="section-heading-row compact">
              <div>
                <h2>Needs Attention</h2>
                <p>Applications are ordered by blocker first, then latest activity.</p>
              </div>
            </div>
            <div className="operations-table-wrapper">
              <table className="operations-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Client</th>
                    <th>PAN</th>
                    <th>Client Code</th>
                    <th>BO ID</th>
                    <th>Blocker</th>
                    <th>Last Error / Note</th>
                    <th>Suggested Next Action</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody id="needs-attention-body">
                  {renderNeedsAttention()}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {reportError && (
        <section id="push-operations-section" className="push-operations-section">
          <div className="error-msg">Failed to load push operations report.</div>
        </section>
      )}

      <div id="metrics-container" className="metrics-grid">
        {metricsError ? (
          <div className="error-msg">Failed to load metrics. Please try again later.</div>
        ) : !metrics ? (
          <div className="loading">Loading metrics...</div>
        ) : (
          integrationsList.map(integration => {
            const m = metrics[integration] || { total: 0, success: 0, pending: 0, rejected: 0 };
            const linkHref = `/clients?integration=${integration.toLowerCase().replace(' ', '')}`;
            
            return (
              <div key={integration} className="integration-card">
                <div className="card-header">
                  <h3>{integration}</h3>
                  <span className="total-badge">{m.total} Total</span>
                </div>
                <div className="card-stats">
                  <div className="stat stat-success">
                    <span className="label">Success</span>
                    <span className="value">{m.success}</span>
                  </div>
                  <div className="stat stat-pending">
                    <span className="label">Pending</span>
                    <span className="value">{m.pending}</span>
                  </div>
                  <div className="stat stat-rejected">
                    <span className="label">Failed/Rejected</span>
                    <span className="value">{m.rejected}</span>
                  </div>
                </div>
                <div className="card-action">
                  <Link to={linkHref} className="view-link">View Records &rarr;</Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
