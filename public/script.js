document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentTab: 'dashboard',
    patients: [],
    appointments: [],
    bills: [],
    stats: {},
    searchTerm: ''
  };

  // DOM Elements
  const tabButtons = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const globalSearch = document.getElementById('globalSearch');
  const dbStatusText = document.getElementById('dbStatusText');

  // Dashboard Elements
  const statPatients = document.getElementById('statPatients');
  const statAppointments = document.getElementById('statAppointments');
  const statRevenuePaid = document.getElementById('statRevenuePaid');
  const statRevenueUnpaid = document.getElementById('statRevenueUnpaid');
  const activityFeed = document.getElementById('activityFeed');

  // Shortcut Buttons
  const shortcutRegister = document.getElementById('shortcutRegister');
  const shortcutBook = document.getElementById('shortcutBook');
  const shortcutBill = document.getElementById('shortcutBill');

  // Forms
  const patientForm = document.getElementById('patientForm');
  const appointmentForm = document.getElementById('appointmentForm');
  const billingForm = document.getElementById('billingForm');
  const patientDatalist = document.getElementById('patientList');

  // Tables / Bodies
  const patientTableBody = document.getElementById('patientTableBody');
  const appointmentTableBody = document.getElementById('appointmentTableBody');
  const billingTableBody = document.getElementById('billingTableBody');

  // Count Badges
  const patientCount = document.getElementById('patientCount');
  const appointmentCount = document.getElementById('appointmentCount');
  const billCount = document.getElementById('billCount');

  // Tab Titles configuration
  const tabMetadata = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of clinical activities and statistics.' },
    patients: { title: 'Patients Registry', subtitle: 'Manage inpatient and outpatient records.' },
    appointments: { title: 'Appointments Schedule', subtitle: 'Organize patient consultations and visits.' },
    billing: { title: 'Billing Ledger', subtitle: 'Generate invoices and track collections.' }
  };

  // ==================== TAB NAVIGATION ====================
  function switchTab(tabId) {
    state.currentTab = tabId;
    
    // Update navigation active state
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update panel visibility
    tabPanels.forEach(panel => {
      if (panel.id === `${tabId}-tab`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update Titles
    const meta = tabMetadata[tabId];
    pageTitle.textContent = meta.title;
    pageSubtitle.textContent = meta.subtitle;

    // Reset search
    globalSearch.value = '';
    state.searchTerm = '';

    // Reload content
    fetchData();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Shortcut buttons triggers
  shortcutRegister.addEventListener('click', () => {
    switchTab('patients');
    setTimeout(() => document.getElementById('regName').focus(), 300);
  });
  shortcutBook.addEventListener('click', () => {
    switchTab('appointments');
    setTimeout(() => document.getElementById('appPatient').focus(), 300);
  });
  shortcutBill.addEventListener('click', () => {
    switchTab('billing');
    setTimeout(() => document.getElementById('billPatient').focus(), 300);
  });

  // ==================== DATA FETCHING & API ====================

  async function fetchData() {
    try {
      // 1. Fetch statistics
      const statsResponse = await fetch('/api/dashboard/stats');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        state.stats = stats;
        updateDashboardUI(stats);
      }

      // 2. Fetch specific tab data
      if (state.currentTab === 'patients') {
        const res = await fetch('/api/patients');
        state.patients = await res.json();
        renderPatients();
      } else if (state.currentTab === 'appointments') {
        const res = await fetch('/api/appointments');
        state.appointments = await res.json();
        renderAppointments();
      } else if (state.currentTab === 'billing') {
        const res = await fetch('/api/billing');
        state.bills = await res.json();
        renderBilling();
      }

      // Populate Datalists for convenience in forms
      populateDatalists();

    } catch (error) {
      console.error('Error fetching data from API:', error);
    }
  }

  async function populateDatalists() {
    try {
      const res = await fetch('/api/patients');
      const patients = await res.json();
      patientDatalist.innerHTML = '';
      patients.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        patientDatalist.appendChild(option);
      });
    } catch (error) {
      console.error('Error populating datalist:', error);
    }
  }

  // ==================== UI RENDERING ====================

  function updateDashboardUI(stats) {
    // Database indicator
    dbStatusText.textContent = stats.databaseType || 'MongoDB';
    
    // Stats counters
    statPatients.textContent = stats.totalPatients || 0;
    statAppointments.textContent = stats.scheduledAppointments || 0;
    statRevenuePaid.textContent = `$${(stats.paidTotal || 0).toLocaleString()}`;
    statRevenueUnpaid.textContent = `$${(stats.unpaidTotal || 0).toLocaleString()}`;

    // Activity Feed Renderer
    renderActivityFeed(stats);
  }

  function renderActivityFeed(stats) {
    activityFeed.innerHTML = '';

    // Merge recent patients, appointments, and bills into a chronological feed
    const items = [];

    if (stats.recentPatients && stats.recentPatients.length > 0) {
      stats.recentPatients.forEach(p => {
        items.push({
          type: 'patient',
          title: `Patient Registered: <strong>${p.name}</strong>`,
          desc: `Condition: ${p.disease} (Age: ${p.age})`,
          date: new Date(p.registrationDate),
          color: 'blue',
          icon: 'P'
        });
      });
    }

    if (stats.recentAppointments && stats.recentAppointments.length > 0) {
      stats.recentAppointments.forEach(a => {
        items.push({
          type: 'appointment',
          title: `Appointment Booked: <strong>${a.patientName}</strong>`,
          desc: `With ${a.doctorName} on ${formatDate(a.date)}`,
          date: new Date(a.date),
          color: 'purple',
          icon: 'A'
        });
      });
    }

    if (stats.recentBills && stats.recentBills.length > 0) {
      stats.recentBills.forEach(b => {
        items.push({
          type: 'bill',
          title: `Invoice Generated: <strong>${b.patientName}</strong>`,
          desc: `Amount: $${b.amount} | Status: <span class="badge ${b.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${b.status}</span>`,
          date: new Date(b.date),
          color: 'green',
          icon: '$'
        });
      });
    }

    // Sort combined items by date descending
    items.sort((a, b) => b.date - a.date);

    if (items.length === 0) {
      activityFeed.innerHTML = '<div class="feed-placeholder">No recent activity. Register patients or book consultations.</div>';
      return;
    }

    // Render top 6 items
    items.slice(0, 6).forEach(item => {
      const feedDiv = document.createElement('div');
      feedDiv.className = 'feed-item';
      feedDiv.innerHTML = `
        <div class="feed-icon" style="background-color: rgba(var(--accent-${item.color}-rgb), 0.2); color: var(--accent-${item.color}); border: 1px solid rgba(var(--accent-${item.color}-rgb), 0.3)">
          ${item.icon}
        </div>
        <div class="feed-content">
          <div class="feed-title">${item.title}</div>
          <div class="feed-meta">
            <span class="feed-desc">${item.desc}</span>
            <span class="feed-time">${timeAgo(item.date)}</span>
          </div>
        </div>
      `;
      activityFeed.appendChild(feedDiv);
    });
  }

  function renderPatients() {
    patientTableBody.innerHTML = '';
    const filtered = state.patients.filter(p => 
      p.name.toLowerCase().includes(state.searchTerm) || 
      p.disease.toLowerCase().includes(state.searchTerm)
    );

    patientCount.textContent = `${filtered.length} of ${state.patients.length} listed`;

    if (filtered.length === 0) {
      patientTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No matching patients found.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${escapeHTML(p.name)}</strong></td>
        <td>${p.age} yrs</td>
        <td><span class="badge badge-info">${escapeHTML(p.disease)}</span></td>
        <td>${new Date(p.registrationDate).toLocaleDateString()}</td>
      `;
      patientTableBody.appendChild(row);
    });
  }

  function renderAppointments() {
    appointmentTableBody.innerHTML = '';
    const filtered = state.appointments.filter(a => 
      a.patientName.toLowerCase().includes(state.searchTerm) || 
      a.doctorName.toLowerCase().includes(state.searchTerm)
    );

    appointmentCount.textContent = `${filtered.length} of ${state.appointments.length} scheduled`;

    if (filtered.length === 0) {
      appointmentTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No matching appointments found.</td></tr>';
      return;
    }

    filtered.forEach(a => {
      const row = document.createElement('tr');
      const statusBadgeClass = a.status === 'Scheduled' ? 'badge-info' : (a.status === 'Completed' ? 'badge-success' : 'badge-danger');
      row.innerHTML = `
        <td><strong>${escapeHTML(a.patientName)}</strong></td>
        <td>${escapeHTML(a.doctorName)}</td>
        <td>${formatDate(a.date)}</td>
        <td><span class="badge ${statusBadgeClass}">${a.status}</span></td>
      `;
      appointmentTableBody.appendChild(row);
    });
  }

  function renderBilling() {
    billingTableBody.innerHTML = '';
    const filtered = state.bills.filter(b => 
      b.patientName.toLowerCase().includes(state.searchTerm)
    );

    billCount.textContent = `${filtered.length} of ${state.bills.length} invoices`;

    if (filtered.length === 0) {
      billingTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No matching transactions found.</td></tr>';
      return;
    }

    filtered.forEach(b => {
      const row = document.createElement('tr');
      const isPaid = b.status === 'Paid';
      const badgeClass = isPaid ? 'badge-success' : 'badge-warning';
      const actionButtonHtml = isPaid 
        ? `<span class="badge badge-success" style="opacity: 0.7;"> Settled</span>`
        : `<button class="pay-btn" data-id="${b._id}">Mark as Paid</button>`;

      row.innerHTML = `
        <td><strong>${escapeHTML(b.patientName)}</strong></td>
        <td>${new Date(b.date).toLocaleDateString()}</td>
        <td><strong>$${b.amount.toLocaleString()}</strong></td>
        <td><span class="badge ${badgeClass}">${b.status}</span></td>
        <td>${actionButtonHtml}</td>
      `;
      billingTableBody.appendChild(row);
    });

    // Attach Pay Click Event Handlers
    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        try {
          const res = await fetch(`/api/billing/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Paid' })
          });
          if (res.ok) {
            fetchData(); // Reload stats and values
          }
        } catch (err) {
          console.error('Failed to update invoice status:', err);
        }
      });
    });
  }

  // ==================== FORM SUBMISSIONS ====================

  patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const age = document.getElementById('regAge').value;
    const disease = document.getElementById('regDisease').value.trim();

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, disease })
      });

      if (res.ok) {
        patientForm.reset();
        fetchData();
        alert('Patient Registered Successfully!');
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Registration API Error:', err);
    }
  });

  appointmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientName = document.getElementById('appPatient').value.trim();
    const doctorName = document.getElementById('appDoctor').value.trim();
    const date = document.getElementById('appDate').value;

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, doctorName, date })
      });

      if (res.ok) {
        appointmentForm.reset();
        fetchData();
        alert('Appointment Booked Successfully!');
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Booking API Error:', err);
    }
  });

  billingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientName = document.getElementById('billPatient').value.trim();
    const amount = document.getElementById('billAmount').value;

    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, amount })
      });

      if (res.ok) {
        billingForm.reset();
        fetchData();
        alert('Bill Invoice Generated Successfully!');
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Billing API Error:', err);
    }
  });

  // ==================== SEARCH / FILTER FILTERING ====================
  globalSearch.addEventListener('input', (e) => {
    state.searchTerm = e.target.value.toLowerCase().trim();
    if (state.currentTab === 'patients') {
      renderPatients();
    } else if (state.currentTab === 'appointments') {
      renderAppointments();
    } else if (state.currentTab === 'billing') {
      renderBilling();
    }
  });

  // ==================== HELPER FUNCTIONS ====================
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);

    if (interval >= 1) return interval + " yrs ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " months ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " days ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " hrs ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " mins ago";
    if (seconds < 10) return "just now";
    return Math.floor(seconds) + " secs ago";
  }

  // Initial load
  fetchData();
  // Poll statistics every 15 seconds to keep it fresh
  setInterval(fetchData, 15000);
});
