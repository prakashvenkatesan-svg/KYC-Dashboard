const SIDEBAR_STATE_KEY = 'kyc_sidebar_integrations_open';
const KYC_STATUS_STATE_KEY = 'kyc_sidebar_status_open';

const INTEGRATION_ITEMS = [
  { id: 'nav-cvlkra', href: 'cvlkra.html', label: 'CVL KRA', icon: 'cvlkra-logo.png' },
  { id: 'nav-cdsl', href: 'cdsl.html', label: 'CDSL', icon: 'cdsl-logo.png' },
  { id: 'nav-nse', href: 'nse.html', label: 'NSE', icon: 'nse-logo.png' },
  { id: 'nav-bse', href: 'bse.html', label: 'BSE', icon: 'bse-logo.png' },
  { id: 'nav-techexcel', href: 'techexcel.html', label: 'TechExcel', icon: 'techexcel-logo.png' }
];

const KYC_STATUS_ITEMS = [
  { id: 'nav-kyc-in-progress', href: 'clients.html?kyc_status=in_progress', label: 'In Progress', value: 'in_progress' },
  { id: 'nav-kyc-completed', href: 'clients.html?kyc_status=completed', label: 'Completed', value: 'completed' }
];

function normalizeKycStatusValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function getStoredClientListState() {
  try {
    return JSON.parse(sessionStorage.getItem('kyc_client_list_state') || '{}');
  } catch (error) {
    return {};
  }
}

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
        <i class="icon">&#128202;</i> Dashboard
      </a>
      <a href="clients.html" class="nav-link" id="nav-clients">
        <i class="icon">&#128101;</i> Clients
      </a>
      <a href="beta.html" class="nav-link" id="nav-beta">
        <i class="icon" style="font-style:normal;">&#946;</i> Beta
      </a>
      <a href="payments.html" class="nav-link" id="nav-payments">
        <i class="icon" style="font-style:normal;">&#128179;</i> Payments
      </a>
      <div class="status-parent" id="kyc-status-menu">
        <div class="nav-link status-toggle" id="kyc-status-toggle" role="button" tabindex="0" aria-expanded="false">
          <i class="icon" style="font-style:normal;">&#9989;</i> <span>KYC Status</span>
          <span class="dropdown-arrow" id="kyc-status-arrow">&#8250;</span>
        </div>
        <div class="status-submenu" id="kyc-status-submenu">
          <a href="clients.html?kyc_status=in_progress" class="nav-link status-sub-link" id="nav-kyc-in-progress" data-kyc-status="in_progress">
            In Progress
          </a>
          <a href="clients.html?kyc_status=completed" class="nav-link status-sub-link" id="nav-kyc-completed" data-kyc-status="completed">
            Completed
          </a>
        </div>
      </div>
      <div class="integration-parent" id="integration-menu">
        <div class="nav-link integration-toggle" id="integration-toggle" role="button" tabindex="0" aria-expanded="false">
          <i class="icon" style="font-style:normal;">&#128279;</i> <span>Integrations</span>
          <span class="dropdown-arrow" id="integration-arrow">&#8250;</span>
        </div>
        <div class="integration-submenu" id="integration-submenu">
          <a href="cvlkra.html" class="nav-link integration-sub-link" id="nav-cvlkra">
            <img src="cvlkra-logo.png" alt="CVL KRA" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> CVL KRA
          </a>
          <a href="cdsl.html" class="nav-link integration-sub-link" id="nav-cdsl">
            <img src="cdsl-logo.png" alt="CDSL" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> CDSL
          </a>
          <a href="nse.html" class="nav-link integration-sub-link" id="nav-nse">
            <img src="nse-logo.png" alt="NSE" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> NSE
          </a>
          <a href="bse.html" class="nav-link integration-sub-link" id="nav-bse">
            <img src="bse-logo.png" alt="BSE" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> BSE
          </a>
          <a href="techexcel.html" class="nav-link integration-sub-link" id="nav-techexcel">
            <img src="techexcel-logo.png" alt="TechExcel" class="icon" style="width: 20px; height: 20px; object-fit: contain; margin-right: 12px; border-radius: 4px; background: white; padding: 2px;"> TechExcel
          </a>
        </div>
      </div>
      <a href="trash.html" class="nav-link" id="nav-trash">
        <i class="icon" style="font-style:normal;">&#128465;</i> Trash
      </a>
    </nav>
  </aside>
`;

function renderSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  container.innerHTML = sidebarHTML;

  const path = window.location.pathname.toLowerCase();
  const integrationPage = INTEGRATION_ITEMS.find(item => path.includes(item.href));
  const storedIntegrationOpen = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
  const storedKycStatusOpen = localStorage.getItem(KYC_STATUS_STATE_KEY) === 'true';
  const storedClientListState = getStoredClientListState();
  const urlParams = new URLSearchParams(window.location.search);
  const activeKycStatus = normalizeKycStatusValue(urlParams.get('kyc_status') || storedClientListState.kycStatus || '');
  const shouldOpenKycStatus = Boolean(activeKycStatus) || storedKycStatusOpen;

  const userStr = localStorage.getItem('kyc_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const mods = user.modules || [];

      if (user.role !== 'Admin') {
        if (!mods.includes('Dashboard')) document.getElementById('nav-dashboard').style.display = 'none';
        if (!mods.includes('Clients')) document.getElementById('nav-clients').style.display = 'none';
        if (document.getElementById('nav-beta')) document.getElementById('nav-beta').style.display = 'none';
        if (!mods.includes('Payments')) document.getElementById('nav-payments').style.display = 'none';
        if (!mods.includes('NSE')) document.getElementById('nav-nse').style.display = 'none';
        if (!mods.includes('BSE')) document.getElementById('nav-bse').style.display = 'none';
        if (!mods.includes('CVL KRA')) document.getElementById('nav-cvlkra').style.display = 'none';
        if (!mods.includes('CDSL')) document.getElementById('nav-cdsl').style.display = 'none';
        if (!mods.includes('TechExcel')) document.getElementById('nav-techexcel').style.display = 'none';

        const trashLink = document.getElementById('nav-trash');
        if (trashLink) trashLink.style.display = 'none';
      }

      if (user.role === 'Admin') {
        const nav = document.querySelector('.sidebar-nav');
        if (nav && !document.getElementById('nav-users')) {
          const a = document.createElement('a');
          a.href = 'users.html';
          a.className = 'nav-link';
          a.id = 'nav-users';
          a.innerHTML = '<i class="icon">&#9881;</i> User Management';
          nav.appendChild(a);
        }
      }
    } catch (error) {}
  }

  const integrationMenu = document.getElementById('integration-menu');
  const integrationToggle = document.getElementById('integration-toggle');
  const integrationSubmenu = document.getElementById('integration-submenu');
  const integrationArrow = document.getElementById('integration-arrow');

  const kycStatusMenu = document.getElementById('kyc-status-menu');
  const kycStatusToggle = document.getElementById('kyc-status-toggle');
  const kycStatusSubmenu = document.getElementById('kyc-status-submenu');
  const kycStatusArrow = document.getElementById('kyc-status-arrow');

  const visibleIntegrationLinks = INTEGRATION_ITEMS.filter(item => {
    const link = document.getElementById(item.id);
    return link && link.style.display !== 'none';
  });

  const shouldOpenIntegrations = Boolean(integrationPage) || storedIntegrationOpen;

  if (visibleIntegrationLinks.length === 0 && integrationMenu) {
    integrationMenu.style.display = 'none';
  } else if (integrationMenu && integrationToggle && integrationSubmenu && integrationArrow) {
    const applyIntegrationState = (isOpen, persist = true) => {
      integrationMenu.classList.toggle('expanded', isOpen);
      integrationSubmenu.classList.toggle('open', isOpen);
      integrationToggle.setAttribute('aria-expanded', String(isOpen));
      integrationArrow.textContent = isOpen ? '&#9662;' : '&#8250;';
      integrationArrow.textContent = isOpen ? '▾' : '›';
      if (persist) localStorage.setItem(SIDEBAR_STATE_KEY, String(isOpen));
    };

    applyIntegrationState(shouldOpenIntegrations, Boolean(integrationPage));

    integrationToggle.addEventListener('click', () => {
      applyIntegrationState(!integrationSubmenu.classList.contains('open'));
    });
    integrationToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyIntegrationState(!integrationSubmenu.classList.contains('open'));
      }
    });
  }

  if (kycStatusMenu && kycStatusToggle && kycStatusSubmenu && kycStatusArrow) {
    const applyKycStatusState = (isOpen, persist = true) => {
      kycStatusMenu.classList.toggle('expanded', isOpen);
      kycStatusSubmenu.classList.toggle('open', isOpen);
      kycStatusToggle.setAttribute('aria-expanded', String(isOpen));
      kycStatusArrow.textContent = isOpen ? '▾' : '›';
      if (persist) localStorage.setItem(KYC_STATUS_STATE_KEY, String(isOpen));
    };

    applyKycStatusState(shouldOpenKycStatus, Boolean(activeKycStatus));

    kycStatusToggle.addEventListener('click', () => {
      applyKycStatusState(!kycStatusSubmenu.classList.contains('open'));
    });
    kycStatusToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyKycStatusState(!kycStatusSubmenu.classList.contains('open'));
      }
    });

    KYC_STATUS_ITEMS.forEach(item => {
      const link = document.getElementById(item.id);
      if (link) {
        link.addEventListener('click', () => {
          sessionStorage.setItem('kyc_sidebar_status_nav', item.value);
        });
      }
    });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    const linkHref = link.getAttribute('href') || '';

    if (linkHref === 'dashboard.html' && path.includes('dashboard.html')) {
      link.classList.add('active');
    } else if (linkHref === 'users.html' && path.includes('users.html')) {
      link.classList.add('active');
    } else if (linkHref === 'clients.html' && path.includes('clients.html') && !link.dataset.kycStatus) {
      link.classList.add('active');
    } else if (linkHref === 'beta.html' && path.includes('beta.html')) {
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
    } else if (linkHref === 'payments.html' && path.includes('payments.html')) {
      link.classList.add('active');
    } else if (linkHref === 'trash.html' && path.includes('trash.html')) {
      link.classList.add('active');
    } else if (link.dataset && link.dataset.kycStatus) {
      if (activeKycStatus && normalizeKycStatusValue(link.dataset.kycStatus) === activeKycStatus) {
        link.classList.add('active');
        if (kycStatusMenu) kycStatusMenu.classList.add('active');
      }
    } else if (INTEGRATION_ITEMS.some(item => item.href === linkHref) && integrationPage && linkHref === integrationPage.href) {
      link.classList.add('active');
      if (integrationMenu) integrationMenu.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', renderSidebar);
