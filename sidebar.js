const sidebarHTML = `
  <aside class="sidebar">
    <div class="sidebar-brand">
      <h2>AIONION Capital</h2>
      <p>KYC Operations</p>
    </div>
    <nav class="sidebar-nav">
      <a href="dashboard.html" class="nav-link" id="nav-dashboard">
        <i class="icon">📊</i> Dashboard
      </a>
      <a href="clients.html" class="nav-link" id="nav-clients">
        <i class="icon">👥</i> Clients
      </a>
      <a href="clients.html?integration=nse" class="nav-link" id="nav-nse">
        <i class="icon">🔗</i> NSE
      </a>
      <a href="clients.html?integration=bse" class="nav-link" id="nav-bse">
        <i class="icon">🔗</i> BSE
      </a>
      <a href="clients.html?integration=cvlkra" class="nav-link" id="nav-cvlkra">
        <i class="icon">🔗</i> CVL KRA
      </a>
      <a href="clients.html?integration=cdsl" class="nav-link" id="nav-cdsl">
        <i class="icon">🔗</i> CDSL
      </a>
      <a href="clients.html?integration=techexcel" class="nav-link" id="nav-techexcel">
        <i class="icon">🔗</i> TechExcel
      </a>
    </nav>
  </aside>
`;

function renderSidebar() {
  const container = document.getElementById('sidebar-container');
  if (container) {
    container.innerHTML = sidebarHTML;
    
    // Highlight active link
    const path = window.location.pathname;
    const search = window.location.search;
    
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkHref = link.getAttribute('href');
      if (linkHref === 'dashboard.html' && path.includes('dashboard.html')) {
        link.classList.add('active');
      } else if (linkHref === 'clients.html' && path.includes('clients.html') && !search.includes('integration=')) {
        link.classList.add('active');
      } else if (path.includes('clients.html') && search.includes('integration=') && linkHref.includes(search)) {
        link.classList.add('active');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', renderSidebar);
