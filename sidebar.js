const sidebarHTML = `
  <aside class="sidebar">
    <div class="sidebar-brand" style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 24px 16px 16px;" onclick="window.location.href='dashboard.html'">
      <img src="logo.png" alt="Logo" style="width: 48px; height: 48px; object-fit: contain; border-radius: 50%;">
      <div>
        <h2 style="margin-bottom: 2px;">AIONION Capital</h2>
        <p style="margin: 0;">KYC Operations</p>
      </div>
    </div>
    <nav class="sidebar-nav">
      <a href="dashboard.html" class="nav-link" id="nav-dashboard">
        <i class="icon">📊</i> Dashboard
      </a>
      <a href="clients.html" class="nav-link" id="nav-clients">
        <i class="icon">👥</i> Clients
      </a>
      <a href="nse.html" class="nav-link" id="nav-nse">
        <img src="nse-logo.png" alt="NSE" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> NSE
      </a>
      <a href="bse.html" class="nav-link" id="nav-bse">
        <img src="bse-logo.png" alt="BSE" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> BSE
      </a>
      <a href="cvlkra.html" class="nav-link" id="nav-cvlkra">
        <img src="cvlkra-logo.png" alt="CVL KRA" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> CVL KRA
      </a>
      <a href="cdsl.html" class="nav-link" id="nav-cdsl">
        <img src="cdsl-logo.png" alt="CDSL" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> CDSL
      </a>
      <a href="techexcel.html" class="nav-link" id="nav-techexcel">
        <img src="techexcel-logo.png" alt="TechExcel" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> TechExcel
      </a>
    </nav>
  </aside>
    </nav>
  </aside>
`;

function renderSidebar() {
  const container = document.getElementById('sidebar-container');
  if (container) {
    container.innerHTML = sidebarHTML;
    
    // Auth & Permissions
    const userStr = localStorage.getItem('kyc_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const mods = user.modules || [];
        
        // Hide if not admin and module not assigned
        if (user.role !== 'Admin') {
          if (!mods.includes('Dashboard')) document.getElementById('nav-dashboard').style.display = 'none';
          if (!mods.includes('Clients')) document.getElementById('nav-clients').style.display = 'none';
          if (!mods.includes('NSE')) document.getElementById('nav-nse').style.display = 'none';
          if (!mods.includes('BSE')) document.getElementById('nav-bse').style.display = 'none';
          if (!mods.includes('CVL KRA')) document.getElementById('nav-cvlkra').style.display = 'none';
          if (!mods.includes('CDSL')) document.getElementById('nav-cdsl').style.display = 'none';
          if (!mods.includes('TechExcel')) document.getElementById('nav-techexcel').style.display = 'none';
        }
        
        // Only Admin sees User Management
        if (user.role === 'Admin') {
          const nav = document.querySelector('.sidebar-nav');
          const a = document.createElement('a');
          a.href = 'users.html';
          a.className = 'nav-link';
          a.id = 'nav-users';
          a.innerHTML = '<i class="icon">⚙️</i> User Management';
          nav.appendChild(a);
        }
      } catch(e) {}
    }
    
    // Highlight active link
    const path = window.location.pathname;
    const search = window.location.search;
    
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkHref = link.getAttribute('href');
      if (linkHref === 'dashboard.html' && path.includes('dashboard.html')) {
        link.classList.add('active');
      } else if (linkHref === 'users.html' && path.includes('users.html')) {
        link.classList.add('active');
      } else if (linkHref === 'clients.html' && path.includes('clients.html')) {
        link.classList.add('active');
      } else if (linkHref === 'nse.html' && path.includes('nse.html')) {
        link.classList.add('active');
      } else if (linkHref === 'bse.html' && path.includes('bse.html')) {
        link.classList.add('active');
      } else if (linkHref === 'cvlkra.html' && path.includes('cvlkra.html')) {
        link.classList.add('active');
      } else if (linkHref === 'cdsl.html' && path.includes('cdsl.html')) {
        link.classList.add('active');
      } else if (linkHref === 'techexcel.html' && path.includes('techexcel.html')) {
        link.classList.add('active');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', renderSidebar);
