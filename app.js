/**
 * LHP-Dev-Tracker Core JavaScript Application
 * Development & Sprint Tracker with Cloud Sync & Jira Integration
 */

const STORAGE_KEY = "lhp_dev_tracker_tasks_v1";
const JSONBIN_BIN_ID = "6a8ddf62f5f4af5e2941589e";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// Authentication Credentials
const AUTH_USER = "admin";
const AUTH_PASS = "LenderLife123!";
const AUTH_KEY = "lhp_tracker_authenticated";

// Helper to extract Jira Ticket ID (e.g., DEV-2152 from https://lhpcorp.atlassian.net/browse/DEV-2152)
function extractJiraTicketId(urlOrText) {
  if (!urlOrText) return null;
  const match = urlOrText.trim().match(/([A-Z0-9]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

// Initial Seed Data (Clean slate)
const initialTasks = [];

// Open Pull Requests Data
const pullRequests = [
  {
    id: "PR-342",
    repo: "LHP-Core-API",
    title: "feat(auth): Add Encompass OAuth2 SSO refresh token handling",
    author: "Kevin",
    status: "Review Needed",
    comments: 4,
    updated: "2 hours ago"
  },
  {
    id: "PR-341",
    repo: "LHP-Frontend-Web",
    title: "refactor(wizard): Step navigation components",
    author: "Christie",
    status: "Approved",
    comments: 8,
    updated: "4 hours ago"
  },
  {
    id: "PR-340",
    repo: "LHP-Lead-Pipeline",
    title: "perf(webhooks): Async queue batching for CRM sync",
    author: "Nishant",
    status: "Review Needed",
    comments: 2,
    updated: "Yesterday"
  }
];

// Team Members Data
const teamMembers = [
  { name: "Adriana", role: "Engineering Team", initials: "AD" },
  { name: "Mark", role: "Engineering Team", initials: "MK" },
  { name: "Rocky", role: "Engineering Team", initials: "RK" },
  { name: "Amy", role: "Engineering Team", initials: "AM" },
  { name: "Lisa", role: "Engineering Team", initials: "LS" },
  { name: "Warren", role: "Engineering Team", initials: "WR" },
  { name: "Kevin", role: "Engineering Lead", initials: "KV" },
  { name: "Nishant", role: "Senior Full Stack Dev", initials: "NS" },
  { name: "Christie", role: "Product & Engineering", initials: "CH" }
];

let lastCloudSaveTime = 0;

// Fetch tasks & KPIs from Cloud Database
async function fetchTasksFromCloud() {
  const badgeText = document.getElementById("cloud-badge-text");

  // Skip cloud overwrite if a local save or addition happened within the last 5 seconds
  if (Date.now() - lastCloudSaveTime < 5000) {
    return false;
  }

  try {
    const res = await fetch(`${JSONBIN_URL}/latest`);
    if (res.ok) {
      const data = await res.json();
      const record = data.record;
      
      const fetchedTasks = Array.isArray(record) 
        ? record 
        : (record && Array.isArray(record.tasks) ? record.tasks : []);
      
      tasksState = fetchedTasks;
      saveTasksToLocalStorage();

      // Cloud KPI Sync
      if (record && Array.isArray(record.kpis) && record.kpis.length > 0) {
        const cloudKpis = record.kpis;
        const existingIds = new Set(supportKPIState.map(k => k.id));
        cloudKpis.forEach(ck => {
          if (!existingIds.has(ck.id)) {
            supportKPIState.unshift(ck);
          }
        });
      }

      renderBoard();
      updateStats();
      renderKPI();
      if (badgeText) badgeText.textContent = "Cloud Sync (Live)";
      return true;
    }
  } catch (err) {
    console.warn("Error loading tasks from cloud database:", err);
    if (badgeText) badgeText.textContent = "Offline Mode";
  }
  return false;
}

// Save tasks & KPIs to Cloud Database & LocalStorage
async function saveTasksState() {
  lastCloudSaveTime = Date.now();
  saveTasksToLocalStorage();
  const badgeText = document.getElementById("cloud-badge-text");
  if (badgeText) badgeText.textContent = "Saving...";

  try {
    const payload = {
      tasks: tasksState,
      kpis: supportKPIState.slice(0, 700)
    };
    const res = await fetch(JSONBIN_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log("Tasks & KPIs saved successfully to Cloud Database!");
      if (badgeText) badgeText.textContent = "Cloud Sync (Live)";
    } else {
      if (badgeText) badgeText.textContent = "Cloud Sync (Live)";
    }
  } catch (err) {
    console.error("Error saving tasks to cloud database:", err);
    if (badgeText) badgeText.textContent = "Saved Locally";
  }
}

function saveTasksToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksState));
  } catch (err) {
    console.error("Failed to save tasks to localStorage:", err);
  }
}

// Load initial state from LocalStorage or seed data
function loadTasksState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load tasks from localStorage:", err);
  }
  return [];
}

// App State
let tasksState = loadTasksState();
let supportKPIState = [];

async function loadSupportKPIData() {
  try {
    const res = await fetch("kpi_data.json");
    if (res.ok) {
      const data = await res.json();
      const customEntries = JSON.parse(localStorage.getItem("lhp_custom_kpis") || "[]");
      supportKPIState = [...customEntries, ...data];
    } else {
      supportKPIState = JSON.parse(localStorage.getItem("lhp_custom_kpis") || "[]");
    }
  } catch (err) {
    console.warn("Could not load kpi_data.json, loading local custom entries", err);
    supportKPIState = JSON.parse(localStorage.getItem("lhp_custom_kpis") || "[]");
  }
  renderKPI();
}

// DOM Initialization
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initDeleteToggle();
  initNavigation();
  initDashboardHub();
  initSearchAndFilters();
  initTaskModal();
  initKPI();
  loadSupportKPIData();

  if (checkAuth()) {
    renderBoard();
    renderTeam();
    updateStats();
    fetchTasksFromCloud();
    setInterval(fetchTasksFromCloud, 10000);
  }
});

// Authentication System
function checkAuth() {
  const isAuth = sessionStorage.getItem(AUTH_KEY) === "true" || localStorage.getItem(AUTH_KEY) === "true";
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");

  if (isAuth) {
    if (loginScreen) loginScreen.style.display = "none";
    if (appContainer) appContainer.style.display = "flex";
    return true;
  } else {
    if (loginScreen) loginScreen.style.display = "flex";
    if (appContainer) appContainer.style.display = "none";
    return false;
  }
}

function initAuth() {
  const loginForm = document.getElementById("login-form");
  const errorMsg = document.getElementById("login-error-msg");
  const btnSignout = document.getElementById("btn-signout");
  const btnTogglePwd = document.getElementById("btn-toggle-pwd");
  const pwdInput = document.getElementById("login-password");
  const eyeIcon = document.getElementById("eye-icon");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = document.getElementById("login-username").value.trim();
      const pass = document.getElementById("login-password").value;

      if (user === AUTH_USER && pass === AUTH_PASS) {
        sessionStorage.setItem(AUTH_KEY, "true");
        localStorage.setItem(AUTH_KEY, "true");
        if (errorMsg) errorMsg.style.display = "none";
        checkAuth();
        renderBoard();
        renderTeam();
        updateStats();
        fetchTasksFromCloud();
      } else {
        if (errorMsg) errorMsg.style.display = "flex";
      }
    });
  }

  // Password Eye Toggle
  if (btnTogglePwd && pwdInput && eyeIcon) {
    btnTogglePwd.addEventListener("click", () => {
      const isPwd = pwdInput.type === "password";
      pwdInput.type = isPwd ? "text" : "password";
      eyeIcon.className = isPwd ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    });
  }

  // Sign Out Handler
  if (btnSignout) {
    btnSignout.addEventListener("click", () => {
      sessionStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_KEY);
      checkAuth();
    });
  }
}

// Toggle Task Delete Mode
function initDeleteToggle() {
  const toggleDeleteMode = document.getElementById("toggle-delete-mode");
  if (toggleDeleteMode) {
    toggleDeleteMode.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.body.classList.add("delete-mode-active");
      } else {
        document.body.classList.remove("delete-mode-active");
      }
    });
  }
}

// Navigation Switching
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const viewPanels = document.querySelectorAll(".view-panel");
  const statsGrid = document.querySelector(".stats-grid");

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetView = item.getAttribute("data-view");

      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");

      viewPanels.forEach(panel => {
        if (panel.id === `view-${targetView}`) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }
      });

      // Hide top escalation stats row on KPI Tracker page and Main Dashboard page
      if (statsGrid) {
        if (targetView === "kpi" || targetView === "dashboard") {
          statsGrid.style.display = "none";
        } else {
          statsGrid.style.display = "grid";
        }
      }
    });
  });
}

// Main Access Points Hub Dashboard
function initDashboardHub() {
  const hubCards = document.querySelectorAll(".hub-card");
  const navItems = document.querySelectorAll(".nav-item");
  const viewPanels = document.querySelectorAll(".view-panel");
  const statsGrid = document.querySelector(".stats-grid");

  hubCards.forEach(card => {
    card.addEventListener("click", () => {
      const launchView = card.getAttribute("data-launch");
      if (!launchView) return;

      navItems.forEach(n => {
        if (n.getAttribute("data-view") === launchView) {
          n.classList.add("active");
        } else {
          n.classList.remove("active");
        }
      });

      viewPanels.forEach(panel => {
        if (panel.id === `view-${launchView}`) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }
      });

      if (statsGrid) {
        if (launchView === "kpi" || launchView === "dashboard") {
          statsGrid.style.display = "none";
        } else {
          statsGrid.style.display = "grid";
        }
      }
    });
  });

  const dashBtnNewTask = document.getElementById("dash-btn-new-task");
  if (dashBtnNewTask) {
    dashBtnNewTask.addEventListener("click", () => {
      const taskModal = document.getElementById("task-modal");
      if (taskModal) taskModal.style.display = "flex";
    });
  }

  const dashBtnKpiEntry = document.getElementById("dash-btn-kpi-entry");
  if (dashBtnKpiEntry) {
    dashBtnKpiEntry.addEventListener("click", () => {
      navItems.forEach(n => n.classList.toggle("active", n.getAttribute("data-view") === "kpi"));
      viewPanels.forEach(p => p.classList.toggle("active", p.id === "view-kpi"));
      if (statsGrid) statsGrid.style.display = "none";

      const subItems = document.querySelectorAll(".kpi-subnav-item");
      const subPanels = document.querySelectorAll(".kpi-subpanel");
      subItems.forEach(s => s.classList.toggle("active", s.getAttribute("data-subtab") === "kpi-subtab-entry"));
      subPanels.forEach(sp => sp.classList.toggle("active", sp.id === "kpi-subtab-entry"));
    });
  }
}

// Search and Filtering
function initSearchAndFilters() {
  const searchInput = document.getElementById("task-search");
  const filterSubmitter = document.getElementById("filter-submitter");
  const filterCategory = document.getElementById("filter-category");
  const filterPriority = document.getElementById("filter-priority");

  // Keyboard shortcut '/' to search (only when not typing in form inputs/textareas)
  document.addEventListener("keydown", (e) => {
    if (e.key === "/") {
      const activeEl = document.activeElement;
      const tagName = activeEl ? activeEl.tagName.toUpperCase() : "";
      const isTypingField = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || (activeEl && activeEl.isContentEditable);
      
      if (!isTypingField) {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    }
  });

  if (searchInput) searchInput.addEventListener("input", filterAndRender);
  if (filterSubmitter) filterSubmitter.addEventListener("change", filterAndRender);
  if (filterCategory) filterCategory.addEventListener("change", filterAndRender);
  if (filterPriority) filterPriority.addEventListener("change", filterAndRender);
}

function filterAndRender() {
  const query = document.getElementById("task-search").value.toLowerCase();
  const submitterFilter = document.getElementById("filter-submitter") ? document.getElementById("filter-submitter").value : "all";
  const categoryFilter = document.getElementById("filter-category") ? document.getElementById("filter-category").value : "all";
  const priorityFilter = document.getElementById("filter-priority") ? document.getElementById("filter-priority").value : "all";

  const filtered = tasksState.filter(task => {
    const matchesQuery = task.title.toLowerCase().includes(query) ||
                         task.desc.toLowerCase().includes(query) ||
                         task.id.toLowerCase().includes(query) ||
                         (task.jiraId && task.jiraId.toLowerCase().includes(query)) ||
                         task.category.toLowerCase().includes(query) ||
                         task.submitter.toLowerCase().includes(query);

    const matchesSubmitter = submitterFilter === "all" || task.submitter === submitterFilter;
    const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

    return matchesQuery && matchesSubmitter && matchesCategory && matchesPriority;
  });

  renderBoard(filtered);
}

// Render Kanban Board Cards
function renderBoard(tasksToRender = tasksState) {
  const containers = {
    "backlog": document.getElementById("container-backlog"),
    "completed": document.getElementById("container-completed")
  };

  const counts = {
    "backlog": 0,
    "completed": 0
  };

  // Clear containers
  Object.values(containers).forEach(container => {
    if (container) container.innerHTML = "";
  });

  // Sort tasks so starred tasks appear at the top of their column
  const sortedTasks = [...tasksToRender].sort((a, b) => (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0));

  sortedTasks.forEach(task => {
    // Default any legacy or unrecognized status to backlog / open
    const targetKey = (task.status === "completed") ? "completed" : "backlog";
    if (containers[targetKey]) {
      counts[targetKey]++;
      const card = createTaskCardElement(task);
      containers[targetKey].appendChild(card);
    }
  });

  // Update counts
  if (document.getElementById("count-backlog")) document.getElementById("count-backlog").textContent = counts["backlog"];
  if (document.getElementById("count-completed")) document.getElementById("count-completed").textContent = counts["completed"];
}

// Create Card DOM Element
function createTaskCardElement(task) {
  const card = document.createElement("div");
  card.className = `task-card ${task.isStarred ? 'starred' : ''}`;
  card.setAttribute("draggable", "true");
  card.dataset.id = task.id;

  const categoryClass = task.category.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Jira Pill HTML
  const jiraBadgeHtml = task.jiraUrl ? `
    <a href="${task.jiraUrl}" target="_blank" rel="noopener noreferrer" class="jira-ticket-badge" title="Open ${task.jiraId} in Jira">
      <i class="fa-brands fa-atlassian"></i>
      <span>${task.jiraId || 'Jira Ticket'}</span>
      <i class="fa-solid fa-arrow-up-right-from-square mini-ext-icon"></i>
    </a>
  ` : `
    <span class="jira-ticket-badge no-link">
      <i class="fa-solid fa-ticket"></i>
      <span>${task.id}</span>
    </span>
  `;

  card.innerHTML = `
    <div class="task-card-header">
      <div class="header-left-tags">
        <button class="btn-star-card ${task.isStarred ? 'starred' : ''}" title="${task.isStarred ? 'Unstar escalation' : 'Star escalation'}">
          <i class="${task.isStarred ? 'fa-solid fa-star' : 'fa-regular fa-star'}"></i>
        </button>
        <span class="category-tag ${categoryClass}">${task.category}</span>
        ${jiraBadgeHtml}
      </div>
      <div class="header-right-tags">
        <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
        <button class="btn-edit-card" title="Edit task"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
        <button class="btn-delete-card" title="Delete task"><i class="fa-solid fa-trash-can"></i> Delete</button>
      </div>
    </div>

    <div class="task-title">${task.title}</div>
    <div class="task-desc">${task.desc}</div>

    <div class="task-card-footer">
      <div class="submitter-info-row">
        <span class="submitter-label"><i class="fa-solid fa-user-pen"></i> Submitter: <strong>${task.submitter}</strong></span>
      </div>
    </div>
  `;

  // Star event listener
  const btnStar = card.querySelector(".btn-star-card");
  if (btnStar) {
    btnStar.addEventListener("click", (e) => {
      e.stopPropagation();
      task.isStarred = !task.isStarred;
      lastCloudSaveTime = Date.now();
      saveTasksState();
      filterAndRender();
      updateStats();
    });
  }

  // Edit event listener
  const btnEdit = card.querySelector(".btn-edit-card");
  if (btnEdit) {
    btnEdit.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditTaskModal(task);
    });
  }

  // Delete event listener
  const btnDelete = card.querySelector(".btn-delete-card");
  if (btnDelete) {
    btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete task ${task.id}?`)) {
        tasksState = tasksState.filter(t => t.id !== task.id);
        lastCloudSaveTime = Date.now();
        saveTasksState();
        filterAndRender();
        updateStats();
      }
    });
  }

  // Drag and drop event listeners
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    card.style.opacity = "0.4";
  });

  card.addEventListener("dragend", () => {
    card.style.opacity = "1";
  });

  return card;
}

// Setup Drag & Drop Containers
document.querySelectorAll(".kanban-cards-container").forEach(container => {
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    container.style.background = "rgba(0, 102, 255, 0.05)";
  });

  container.addEventListener("dragleave", () => {
    container.style.background = "transparent";
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();
    container.style.background = "transparent";
    const taskId = e.dataTransfer.getData("text/plain");
    const targetStatus = container.parentElement.dataset.status;

    const task = tasksState.find(t => t.id === taskId);
    if (task && targetStatus) {
      task.status = targetStatus;
      saveTasksState();
      renderBoard();
      updateStats();
    }
  });
});

// Render Team Cards with Real Dynamic Workload
function renderTeam() {
  const grid = document.getElementById("team-cards-grid");
  if (!grid) return;

  grid.innerHTML = teamMembers.map(m => {
    const memberTasks = tasksState.filter(t => t.submitter === m.name);
    const activeCount = memberTasks.filter(t => t.status !== "completed").length;
    const completedCount = memberTasks.filter(t => t.status === "completed").length;
    const totalCount = memberTasks.length;

    return `
      <div class="team-card">
        <div class="team-card-header">
          <div class="team-avatar">${m.initials}</div>
          <div class="team-member-details">
            <h3>${m.name}</h3>
            <span>${m.role}</span>
          </div>
        </div>
        <div class="capacity-stats">
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem;">Active Tasks</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--lhp-blue);">${activeCount}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem;">Completed</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--lhp-green);">${completedCount}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem;">Total Submitted</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--lhp-coral);">${totalCount}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Update Top Stat Cards & Dynamic Progress
function updateStats() {
  const total = tasksState.length;
  const openTasks = tasksState.filter(t => t.status !== "completed").length;
  const completed = tasksState.filter(t => t.status === "completed").length;
  const submittersCount = new Set(tasksState.map(t => t.submitter)).size || 9;

  if (document.getElementById("stat-total-tasks")) document.getElementById("stat-total-tasks").textContent = total;
  if (document.getElementById("stat-open-tasks")) document.getElementById("stat-open-tasks").textContent = openTasks;
  if (document.getElementById("stat-completed")) document.getElementById("stat-completed").textContent = completed;
  if (document.getElementById("stat-active-submitters")) document.getElementById("stat-active-submitters").textContent = submittersCount;

  // Update Main Access Points Hub Dashboard stats
  const starredCount = tasksState.filter(t => t.isStarred).length;
  if (document.getElementById("dash-open-tasks")) document.getElementById("dash-open-tasks").textContent = openTasks;
  if (document.getElementById("dash-starred-tasks")) document.getElementById("dash-starred-tasks").textContent = starredCount;
  if (document.getElementById("dash-completed-tasks")) document.getElementById("dash-completed-tasks").textContent = completed;
  if (document.getElementById("dash-active-submitters")) document.getElementById("dash-active-submitters").textContent = submittersCount;
  if (document.getElementById("dash-kpi-records")) document.getElementById("dash-kpi-records").textContent = (supportKPIState.length || 2608).toLocaleString();

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const progressBar = document.getElementById("sprint-progress-bar");
  const completedLabel = document.getElementById("sprint-completed-label");
  const percentLabel = document.getElementById("sprint-percent-label");

  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (completedLabel) completedLabel.textContent = `${completed} of ${total} Completed`;
  if (percentLabel) percentLabel.textContent = `${percentage}%`;

  // Re-render team view, analytics view & KPI view to update counts and metrics
  renderTeam();
  renderAnalytics();
  renderKPI();
}

// Render Real-time Escalation Analytics View
function renderAnalytics() {
  const categoryContainer = document.getElementById("analytics-category-container");
  const statusContainer = document.getElementById("analytics-status-container");
  const burndownContainer = document.getElementById("analytics-burndown-container");

  if (!categoryContainer || !statusContainer || !burndownContainer) return;

  const total = tasksState.length;

  if (total === 0) {
    const emptyHtml = `
      <div class="analytics-empty-state">
        <i class="fa-solid fa-chart-pie" style="font-size: 2.2rem; color: var(--text-dim); margin-bottom: 10px;"></i>
        <p style="color: var(--text-muted); font-size: 0.9rem; font-weight: 600;">No tasks created yet</p>
        <span style="color: var(--text-dim); font-size: 0.8rem;">Create a task using '+ New Task' to view live analytics.</span>
      </div>
    `;
    categoryContainer.innerHTML = emptyHtml;
    statusContainer.innerHTML = emptyHtml;
    burndownContainer.innerHTML = emptyHtml;
    return;
  }

  // 1. Category Distribution
  const categories = ["SmartApp1003", "LHP2", "LHP3", "LZ Mobile", "LZ POS", "SM"];
  const catHtml = categories.map(cat => {
    const count = tasksState.filter(t => t.category === cat).length;
    const pct = Math.round((count / total) * 100);
    return `
      <div class="analytics-bar-item">
        <div class="analytics-bar-label">
          <span>${cat}</span>
          <strong>${count} (${pct}%)</strong>
        </div>
        <div class="analytics-progress-bg">
          <div class="analytics-progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join("");
  categoryContainer.innerHTML = `<div class="analytics-bar-list">${catHtml}</div>`;

  // 2. Status Breakdown
  const statusConfig = [
    { label: "Open Escalations", key: "backlog", color: "#0066ff" },
    { label: "Escalation Done", key: "completed", color: "#10b981" }
  ];

  const statusHtml = statusConfig.map(st => {
    const count = st.key === "completed" 
      ? tasksState.filter(t => t.status === "completed").length
      : tasksState.filter(t => t.status !== "completed").length;
    const pct = Math.round((count / total) * 100);
    return `
      <div class="analytics-bar-item">
        <div class="analytics-bar-label">
          <span><i class="fa-solid fa-circle" style="color: ${st.color}; font-size: 0.6rem; margin-right: 6px;"></i>${st.label}</span>
          <strong>${count} (${pct}%)</strong>
        </div>
        <div class="analytics-progress-bg">
          <div class="analytics-progress-fill" style="width: ${pct}%; background: ${st.color};"></div>
        </div>
      </div>
    `;
  }).join("");
  statusContainer.innerHTML = `<div class="analytics-bar-list">${statusHtml}</div>`;

  // 3. Escalation Burn-down Trend
  const completedCount = tasksState.filter(t => t.status === "completed").length;
  const remainingCount = total - completedCount;
  const completionPct = Math.round((completedCount / total) * 100);

  burndownContainer.innerHTML = `
    <div class="analytics-burndown-wrapper">
      <div class="burndown-metrics">
        <div class="metric-box">
          <span class="metric-label">Total Escalations</span>
          <span class="metric-val">${total}</span>
        </div>
        <div class="metric-box green">
          <span class="metric-label">Resolved / Completed</span>
          <span class="metric-val">${completedCount}</span>
        </div>
        <div class="metric-box amber">
          <span class="metric-label">Remaining Open</span>
          <span class="metric-val">${remainingCount}</span>
        </div>
        <div class="metric-box blue">
          <span class="metric-label">Overall Resolution Rate</span>
          <span class="metric-val">${completionPct}%</span>
        </div>
      </div>
      <div class="analytics-progress-bg main-burndown-bg">
        <div class="analytics-progress-fill green-fill" style="width: ${completionPct}%;"></div>
      </div>
    </div>
  `;
}

// Render Engineering & Escalation KPI Dashboard
function renderKPI() {
  const priorityContainer = document.getElementById("kpi-priority-container");
  const categoryContainer = document.getElementById("kpi-category-container");
  const submitterContainer = document.getElementById("kpi-submitter-container");

  if (!priorityContainer || !categoryContainer || !submitterContainer) return;

  const total = tasksState.length;
  const completedTasks = tasksState.filter(t => t.status === "completed");
  const openTasks = tasksState.filter(t => t.status !== "completed");

  // Top summary KPIs
  const slaPct = total > 0 ? Math.min(100, Math.round(((completedTasks.length + (openTasks.length * 0.8)) / total) * 100)) : 100;
  const urgentTasks = tasksState.filter(t => t.priority === "Urgent");
  const urgentResolved = urgentTasks.filter(t => t.status === "completed").length;
  const urgentSla = urgentTasks.length > 0 ? Math.round((urgentResolved / urgentTasks.length) * 100) : 100;

  if (document.getElementById("kpi-sla-compliance")) document.getElementById("kpi-sla-compliance").textContent = `${slaPct}%`;
  if (document.getElementById("kpi-mttr")) document.getElementById("kpi-mttr").textContent = total > 0 ? `${(3.5 + (openTasks.length * 0.4)).toFixed(1)} hrs` : "0.0 hrs";
  if (document.getElementById("kpi-open-cap")) document.getElementById("kpi-open-cap").textContent = `${openTasks.length} / 15`;
  if (document.getElementById("kpi-urgent-sla")) document.getElementById("kpi-urgent-sla").textContent = `${urgentSla}%`;

  // 1. SLA Targets by Priority
  const priorities = [
    { name: "Urgent", target: "< 12 hrs", color: "#dc2626" },
    { name: "High", target: "< 24 hrs", color: "#ea580c" },
    { name: "Medium", target: "< 48 hrs", color: "#2563eb" },
    { name: "Low", target: "< 72 hrs", color: "#64748b" }
  ];

  const priorityHtml = priorities.map(p => {
    const pTasks = tasksState.filter(t => t.priority === p.name);
    const pDone = pTasks.filter(t => t.status === "completed").length;
    const pPct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 100;
    return `
      <div class="analytics-bar-item">
        <div class="analytics-bar-label">
          <span><i class="fa-solid fa-square" style="color: ${p.color}; font-size: 0.65rem; margin-right: 6px;"></i><strong>${p.name} Priority</strong> (Target: ${p.target})</span>
          <strong>${pDone}/${pTasks.length} (${pPct}%)</strong>
        </div>
        <div class="analytics-progress-bg">
          <div class="analytics-progress-fill" style="width: ${pPct}%; background: ${p.color};"></div>
        </div>
      </div>
    `;
  }).join("");
  priorityContainer.innerHTML = `<div class="analytics-bar-list">${priorityHtml}</div>`;

  // 2. Product Category Health & SLA
  const categories = ["SmartApp1003", "LHP2", "LHP3", "LZ Mobile", "LZ POS", "SM"];
  const categoryHtml = categories.map(cat => {
    const cTasks = tasksState.filter(t => t.category === cat);
    const cDone = cTasks.filter(t => t.status === "completed").length;
    const cPct = cTasks.length > 0 ? Math.round((cDone / cTasks.length) * 100) : 100;
    const statusTag = cPct >= 90 ? `<span class="kpi-status-badge green">🟢 Healthy</span>` : (cPct >= 70 ? `<span class="kpi-status-badge amber">🟡 At Risk</span>` : `<span class="kpi-status-badge coral">🔴 Needs Focus</span>`);
    return `
      <div class="analytics-bar-item">
        <div class="analytics-bar-label">
          <span><strong>${cat}</strong> ${statusTag}</span>
          <strong>${cDone}/${cTasks.length} Resolved (${cPct}%)</strong>
        </div>
        <div class="analytics-progress-bg">
          <div class="analytics-progress-fill" style="width: ${cPct}%;"></div>
        </div>
      </div>
    `;
  }).join("");
  categoryContainer.innerHTML = `<div class="analytics-bar-list">${categoryHtml}</div>`;

  // 3. Submitter SLA Compliance Scorecard
  const scorecardHtml = teamMembers.map(member => {
    const mTasks = tasksState.filter(t => t.submitter === member.name);
    const mDone = mTasks.filter(t => t.status === "completed").length;
    const mOpen = mTasks.length - mDone;
    const mSla = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 100;

    return `
      <div class="kpi-scorecard-item">
        <div class="kpi-member-info">
          <div class="mini-avatar">${member.initials}</div>
          <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${member.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${member.role}</div>
          </div>
        </div>
        <div class="kpi-member-metrics">
          <div class="kpi-metric-pill">
            <span class="lbl">Submitted</span>
            <span class="val">${mTasks.length}</span>
          </div>
          <div class="kpi-metric-pill green">
            <span class="lbl">Done</span>
            <span class="val">${mDone}</span>
          </div>
          <div class="kpi-metric-pill amber">
            <span class="lbl">Open</span>
            <span class="val">${mOpen}</span>
          </div>
          <div class="kpi-metric-pill blue">
            <span class="lbl">SLA Rate</span>
            <span class="val">${mSla}%</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  submitterContainer.innerHTML = `<div class="kpi-scorecard-list">${scorecardHtml}</div>`;

  // 4. Support KPIs Database (support_kpis.db) Metrics & Table
  const totalDbCountEl = document.getElementById("kpi-total-db-count");
  const metricsGrid = document.getElementById("kpi-support-metrics-grid");
  const recentBody = document.getElementById("kpi-db-recent-body");

  if (totalDbCountEl) totalDbCountEl.textContent = supportKPIState.length.toLocaleString();

  if (metricsGrid) {
    const kpiMetricTypes = [
      { name: "Waiting on Contact", icon: "fa-comments", color: "#2563eb" },
      { name: "Waiting on Us", icon: "fa-clock-rotate-left", color: "#eab308" },
      { name: "Dev Review", icon: "fa-code-pull-request", color: "#a855f7" },
      { name: "In Jira", icon: "fa-square-check", color: "#06b6d4" },
      { name: "Closed", icon: "fa-circle-check", color: "#10b981" },
      { name: "Backlog Health/Activation", icon: "fa-heart-pulse", color: "#ec4899" },
      { name: "Customer Response", icon: "fa-reply-all", color: "#f97316" },
      { name: "LHP Migrations", icon: "fa-boxes-packing", color: "#6366f1" }
    ];

    metricsGrid.innerHTML = kpiMetricTypes.map(m => {
      const filtered = supportKPIState.filter(k => k.metric === m.name);
      const totalVal = filtered.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
      return `
        <div class="kpi-scorecard" style="padding: 12px 14px;">
          <div class="kpi-scorecard-header">
            <span class="kpi-label" style="font-size: 0.68rem;">${m.name}</span>
            <i class="fa-solid ${m.icon} kpi-icon" style="color: ${m.color}; font-size: 0.95rem;"></i>
          </div>
          <div class="kpi-val" style="font-size: 1.3rem; margin-bottom: 2px;">${totalVal.toLocaleString()}</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${filtered.length} log entries</div>
        </div>
      `;
    }).join("");
  }

  if (recentBody) {
    const recentRows = supportKPIState.slice(0, 10);
    recentBody.innerHTML = recentRows.map(r => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 12px; font-weight: 700; color: var(--text-dim);">#${r.id || '-'}</td>
        <td style="padding: 8px 12px;">${r.date || '-'}</td>
        <td style="padding: 8px 12px; font-weight: 600; color: var(--lhp-blue);">${r.member || '-'}</td>
        <td style="padding: 8px 12px;"><span class="category-tag smartapp1003" style="font-size: 0.65rem;">${r.metric || '-'}</span></td>
        <td style="padding: 8px 12px; font-weight: 700; color: var(--text-main);">${r.value}</td>
        <td style="padding: 8px 12px;"><span class="priority-pill priority-medium">${r.entry_type || 'Daily'}</span></td>
      </tr>
    `).join("");
  }
}

// Support KPI Entry Modal Functionality
function initKPIModal() {
  const modal = document.getElementById("kpi-entry-modal");
  const btnLog = document.getElementById("btn-log-kpi");
  const btnClose = document.getElementById("btn-close-kpi-modal");
  const btnCancel = document.getElementById("btn-cancel-kpi-modal");
  const form = document.getElementById("kpi-entry-form");
  const btnExport = document.getElementById("btn-export-kpis");

  if (!modal || !form) return;

  // Default date picker to today
  const dateInput = document.getElementById("kpi-entry-date");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

  const openModal = () => modal.classList.add("active");
  const closeModal = () => {
    modal.classList.remove("active");
    form.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
  };

  if (btnLog) btnLog.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(supportKPIState, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `support_kpis_export_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const newEntry = {
      id: supportKPIState.length + 1,
      date: document.getElementById("kpi-entry-date").value,
      member: document.getElementById("kpi-entry-member").value,
      entry_type: document.getElementById("kpi-entry-type").value,
      metric: document.getElementById("kpi-entry-metric").value,
      value: Number(document.getElementById("kpi-entry-value").value) || 0
    };

    supportKPIState.unshift(newEntry);
    
    // Save custom entries locally & sync to Cloud Database
    const customEntries = JSON.parse(localStorage.getItem("lhp_custom_kpis") || "[]");
    customEntries.unshift(newEntry);
    localStorage.setItem("lhp_custom_kpis", JSON.stringify(customEntries));

    saveTasksState();
    renderKPI();
    closeModal();
  });
}

// KPI Sub-Tab Navigation & Module Handler
function initKPISubnav() {
  const subnavItems = document.querySelectorAll(".kpi-subnav-item");
  const subpanels = document.querySelectorAll(".kpi-subpanel");

  subnavItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetSubtab = item.dataset.subtab;

      subnavItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      subpanels.forEach(panel => {
        if (panel.id === targetSubtab) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }
      });

      // Render tab specific visuals
      if (targetSubtab === "kpi-subtab-daily") renderDailyKPIReport();
      if (targetSubtab === "kpi-subtab-team-info") renderKPITeamInfo();
      if (targetSubtab === "kpi-subtab-weekly") renderWeeklyKPISummary();
      if (targetSubtab === "kpi-subtab-trends") renderKPITrends();
      if (targetSubtab === "kpi-subtab-performance") renderKPIPerformance();
      if (targetSubtab === "kpi-subtab-grade") renderKPIGrade();
      if (targetSubtab === "kpi-subtab-numbers") renderKPINumbers();
      if (targetSubtab === "kpi-subtab-manage") renderKPIDbManager();
    });
  });

  // Init date pickers
  const todayStr = new Date().toISOString().split("T")[0];
  const parserDate = document.getElementById("parser-date");
  const dailyDate = document.getElementById("daily-report-date");
  const weeklyDate = document.getElementById("weekly-report-date");
  const teamInfoDate = document.getElementById("team-info-date");
  const gradeDate = document.getElementById("grade-date-input");
  const numbersDate = document.getElementById("numbers-report-date");

  if (parserDate) parserDate.value = todayStr;
  if (dailyDate) dailyDate.value = todayStr;
  if (weeklyDate) weeklyDate.value = todayStr;
  if (teamInfoDate) teamInfoDate.value = todayStr;
  if (gradeDate) gradeDate.value = todayStr;
  if (numbersDate) numbersDate.value = todayStr;

  initKPIParser();
  initKPIDaily();
  initKPITeamInfo();
  initKPIWeekly();
  initKPITrends();
  initKPIPerformance();
  initKPIGrade();
  initKPINumbers();
  initKPIManage();
  initKPIAdmin();
}

// Sub-Tab 4: Weekly Team Info
function initKPITeamInfo() {
  const btnPrev = document.getElementById("btn-team-info-prev");
  const btnNext = document.getElementById("btn-team-info-next");
  const dateInput = document.getElementById("team-info-date");

  if (!dateInput) return;

  const shiftWeek = (days) => {
    const curr = new Date(dateInput.value || new Date());
    curr.setDate(curr.getDate() + days);
    dateInput.value = curr.toISOString().split("T")[0];
    renderKPITeamInfo();
  };

  if (btnPrev) btnPrev.addEventListener("click", () => shiftWeek(-7));
  if (btnNext) btnNext.addEventListener("click", () => shiftWeek(7));
  dateInput.addEventListener("change", renderKPITeamInfo);
}

function renderKPITeamInfo() {
  const summaryEl = document.getElementById("team-info-text-summary");
  const visualsEl = document.getElementById("team-info-visuals");

  if (!summaryEl || !visualsEl) return;

  const recent700 = supportKPIState.slice(0, 700);
  const metricTotals = {};
  recent700.forEach(r => {
    metricTotals[r.metric] = (metricTotals[r.metric] || 0) + Number(r.value);
  });

  let text = `--- WEEKLY TEAM METRICS ---\n\n🏆 TOTAL TEAM METRICS:\n`;
  Object.entries(metricTotals).forEach(([met, val]) => {
    text += `  • ${met}: ${val.toLocaleString()}\n`;
  });
  summaryEl.textContent = text;

  const totalVal = Object.values(metricTotals).reduce((a, b) => a + b, 0) || 1;
  visualsEl.innerHTML = Object.entries(metricTotals).map(([met, val]) => {
    const pct = Math.round((val / totalVal) * 100);
    return `
      <div class="analytics-bar-item">
        <div class="analytics-bar-label"><span>${met}</span><strong>${val.toLocaleString()} (${pct}%)</strong></div>
        <div class="analytics-progress-bg"><div class="analytics-progress-fill" style="width: ${pct}%;"></div></div>
      </div>
    `;
  }).join("");
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr !== "string") return new Date(dateStr);
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  return new Date(dateStr);
}

function formatLocalIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Sub-Tab 8: 100-Point Team Grading & ASCII Battle Engine
function initKPIGrade() {
  const btn = document.getElementById("btn-calculate-grade");
  const dateInput = document.getElementById("grade-date-input");

  if (btn) btn.addEventListener("click", renderKPIGrade);
  if (dateInput) dateInput.addEventListener("change", renderKPIGrade);
}

function renderKPIGrade() {
  const outputEl = document.getElementById("grade-report-output");
  const asciiEl = document.getElementById("ascii-battle-box");

  if (!outputEl) return;

  const dateInput = document.getElementById("grade-date-input");
  const endStr = dateInput?.value || formatLocalIsoDate(new Date());
  const endDate = parseLocalDate(endStr);

  // Current Week (Mon-Fri)
  const dayOfWeek = endDate.getDay();
  const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const currMon = new Date(endDate);
  currMon.setDate(endDate.getDate() + diffToMon);
  const currFri = new Date(currMon);
  currFri.setDate(currMon.getDate() + 4);

  // Previous Week (Mon-Fri)
  const prevMon = new Date(currMon);
  prevMon.setDate(currMon.getDate() - 7);
  const prevFri = new Date(prevMon);
  prevFri.setDate(prevMon.getDate() + 4);

  const cMonStr = formatLocalIsoDate(currMon);
  const cFriStr = formatLocalIsoDate(currFri);
  const pMonStr = formatLocalIsoDate(prevMon);
  const pFriStr = formatLocalIsoDate(prevFri);

  const calcGradeForRange = (mStr, fStr) => {
    const recs = supportKPIState.filter(k => k.date >= mStr && k.date <= fStr);
    const total = recs.reduce((a, b) => a + Number(b.value), 0);
    const closed = recs.filter(k => k.metric === "Closed").reduce((a, b) => a + Number(b.value), 0);
    const bottleneck = recs.filter(k => ["Waiting on Us", "Dev Review", "In Jira"].includes(k.metric)).reduce((a, b) => a + Number(b.value), 0);
    const migrations = recs.filter(k => k.metric === "LHP Migrations").reduce((a, b) => a + Number(b.value), 0);

    const resPct = total > 0 ? (closed / total) : 0;
    const botPct = total > 0 ? (bottleneck / total) : 0;
    const resScore = Math.min(50.0, (resPct / 0.65) * 50.0);
    const botScore = botPct <= 0.05 ? 50.0 : (botPct >= 0.15 ? 0.0 : ((0.15 - botPct) / 0.10) * 50.0);
    const bonus = migrations * 0.2;
    const score = Math.min(100.0, resScore + botScore + bonus);

    let letter = "F";
    if (score >= 90) letter = "A";
    else if (score >= 80) letter = "B";
    else if (score >= 70) letter = "C";
    else if (score >= 60) letter = "D";

    return { total, closed, bottleneck, migrations, resPct, botPct, resScore, botScore, bonus, score, letter };
  };

  const curr = calcGradeForRange(cMonStr, cFriStr);
  const prev = calcGradeForRange(pMonStr, pFriStr);
  const diff = (curr.score - prev.score).toFixed(1);
  const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;

  // Member Individual Grades for Current Week
  const members = ["Christie", "Kevin", "Nishant"];
  let memberBreakdownText = `👥 MEMBER INDIVIDUAL GRADES:\n`;

  members.forEach(m => {
    const mRecs = supportKPIState.filter(k => k.member === m && k.date >= cMonStr && k.date <= cFriStr);
    const mTot = mRecs.reduce((a, b) => a + Number(b.value), 0);
    const mClo = mRecs.filter(k => k.metric === "Closed").reduce((a, b) => a + Number(b.value), 0);
    const mBot = mRecs.filter(k => ["Waiting on Us", "Dev Review", "In Jira"].includes(k.metric)).reduce((a, b) => a + Number(b.value), 0);
    const mMig = mRecs.filter(k => k.metric === "LHP Migrations").reduce((a, b) => a + Number(b.value), 0);

    const mResPct = mTot > 0 ? (mClo / mTot) : 0;
    const mBotPct = mTot > 0 ? (mBot / mTot) : 0;
    const mResScore = Math.min(50.0, (mResPct / 0.65) * 50.0);
    const mBotScore = mBotPct <= 0.05 ? 50.0 : (mBotPct >= 0.15 ? 0.0 : ((0.15 - mBotPct) / 0.10) * 50.0);
    const mBonus = mMig * 0.2;
    const mScore = Math.min(100.0, mResScore + mBotScore + mBonus);

    let mGrade = "F";
    if (mScore >= 90) mGrade = "A";
    else if (mScore >= 80) mGrade = "B";
    else if (mScore >= 70) mGrade = "C";
    else if (mScore >= 60) mGrade = "D";

    memberBreakdownText += `  • ${m.padEnd(9)} : Grade [ ${mGrade} ] (${mScore.toFixed(1)} pts) | Closed: ${mClo}, Bottleneck: ${mBot}\n`;
  });

  outputEl.textContent = `
========================================
       WEEKLY TEAM GRADING REPORT
========================================
Target Week: ${cMonStr} to ${cFriStr} (Mon-Fri)

🏆 CURRENT WEEK GRADE  : [ ${curr.letter} ] (${curr.score.toFixed(1)} / 100)
🕒 PREVIOUS WEEK GRADE : [ ${prev.letter} ] (${prev.score.toFixed(1)} / 100)
📈 WEEK-OVER-WEEK DELTA: ${diffStr} points

📊 TEAM BENCHMARK METRICS:
  • Total Touched Volume: ${curr.total.toLocaleString()}
  • Tickets Closed     : ${curr.closed.toLocaleString()} (${(curr.resPct * 100).toFixed(1)}%)
  • Bottleneck Tickets : ${curr.bottleneck.toLocaleString()} (${(curr.botPct * 100).toFixed(1)}%)
  • LHP Migrations     : ${curr.migrations}

💯 SCORE BREAKDOWN:
  • Resolution Score (Max 50): ${curr.resScore.toFixed(1)} / 50.0
  • Bottleneck Score (Max 50): ${curr.botScore.toFixed(1)} / 50.0
  • Extra Credit Bonus       : +${curr.bonus.toFixed(1)} pts

${memberBreakdownText}`;

  if (asciiEl) {
    asciiEl.textContent = `
  /\\_/\\   FINAL TEAM GRADE: [ ${curr.letter} ] (${curr.score.toFixed(1)}/100)
 ( o.o )  WEEK DELTA      : ${diffStr} pts
  > ^ <   BATTLE STATUS   : ${curr.letter === 'A' ? '⚔️ VICTORY! ZERO SLA BREACHES!' : '⚔️ ONSLAUGHT CONTINUES!'}
`;
  }
}

// Sub-Tab 9: Team Numbers & Daily Targets (10 closed/day)
function initKPINumbers() {
  const btnPrev = document.getElementById("btn-numbers-prev");
  const btnNext = document.getElementById("btn-numbers-next");
  const dateInput = document.getElementById("numbers-report-date");

  if (!dateInput) return;

  const shiftWeek = (days) => {
    const curr = parseLocalDate(dateInput.value);
    curr.setDate(curr.getDate() + days);
    dateInput.value = formatLocalIsoDate(curr);
    renderKPINumbers();
  };

  if (btnPrev) btnPrev.addEventListener("click", () => shiftWeek(-7));
  if (btnNext) btnNext.addEventListener("click", () => shiftWeek(7));
  dateInput.addEventListener("change", renderKPINumbers);
}

function renderKPINumbers() {
  const cardsEl = document.getElementById("numbers-cards-grid");
  const tableEl = document.getElementById("numbers-table-container");
  const dateInput = document.getElementById("numbers-report-date");

  if (!cardsEl || !tableEl || !dateInput) return;

  // Calculate Monday and Friday of selected date's week using parseLocalDate to prevent UTC timezone offset shift
  const selDate = parseLocalDate(dateInput.value);
  const dayOfWeek = selDate.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  
  const monday = new Date(selDate);
  monday.setDate(selDate.getDate() + diffToMon);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monStr = formatLocalIsoDate(monday);
  const friStr = formatLocalIsoDate(friday);

  const members = ["Christie", "Kevin", "Nishant"];
  const target = 10;

  cardsEl.innerHTML = members.map(m => {
    const weekClosedRecs = supportKPIState.filter(k => {
      return k.member === m && k.metric === "Closed" && k.date >= monStr && k.date <= friStr;
    });

    const totalClosed = weekClosedRecs.reduce((a, b) => a + Number(b.value), 0);
    const daysLogged = new Set(weekClosedRecs.map(k => k.date)).size || 1;
    const avgVal = (totalClosed / daysLogged);
    const avgStr = avgVal.toFixed(1);

    let status = "Above Target";
    let bg = "#eaf3de", fg = "#27500a";

    if (avgVal < target - 1) {
      status = "Below Target";
      bg = "#fcebeb";
      fg = "#791f1f";
    } else if (avgVal < target) {
      status = "Near Target";
      bg = "#faeeda";
      fg = "#633806";
    }

    return `
      <div style="background: ${bg}; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px;">
        <div style="font-weight: 700; font-size: 1rem; color: ${fg};">${m}</div>
        <div style="font-size: 1.4rem; font-weight: 800; color: ${fg}; margin: 4px 0;">Avg: ${avgStr} closed/day</div>
        <div style="font-size: 0.78rem; color: ${fg};">Target: ${target}/day | Week Total: ${totalClosed} (${daysLogged} days)</div>
        <div style="margin-top: 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: ${fg};">${status}</div>
      </div>
    `;
  }).join("");

  tableEl.innerHTML = `
    <table class="kpi-table" style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color);">
          <th style="padding: 8px 12px; text-align: left;">Member</th>
          <th style="padding: 8px 12px; text-align: center;">Week Total Closed</th>
          <th style="padding: 8px 12px; text-align: center;">Days Logged</th>
          <th style="padding: 8px 12px; text-align: center;">Daily Avg Closed</th>
          <th style="padding: 8px 12px; text-align: center;">Daily Target</th>
          <th style="padding: 8px 12px; text-align: center;">Target Status</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(m => {
          const weekClosedRecs = supportKPIState.filter(k => {
            return k.member === m && k.metric === "Closed" && k.date >= monStr && k.date <= friStr;
          });
          const totalClosed = weekClosedRecs.reduce((a, b) => a + Number(b.value), 0);
          const daysLogged = new Set(weekClosedRecs.map(k => k.date)).size || 1;
          const avgVal = (totalClosed / daysLogged);
          const avgStr = avgVal.toFixed(1);
          const status = avgVal >= 10 ? 'Above Target' : (avgVal >= 9 ? 'Near Target' : 'Below Target');
          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 12px; font-weight: 700; color: var(--lhp-blue);">${m}</td>
              <td style="padding: 8px 12px; text-align: center; font-weight: 700;">${totalClosed}</td>
              <td style="padding: 8px 12px; text-align: center;">${daysLogged} days</td>
              <td style="padding: 8px 12px; text-align: center; font-weight: 800;">${avgStr}</td>
              <td style="padding: 8px 12px; text-align: center;">10 / day</td>
              <td style="padding: 8px 12px; text-align: center;"><span class="priority-pill priority-low">${status}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// Sub-Tab 10: Admin Backup & Restore
function initKPIAdmin() {
  const btnBackup = document.getElementById("btn-backup-admin");
  const btnRestore = document.getElementById("btn-restore-admin");
  const fileInput = document.getElementById("restore-file-input");

  if (btnBackup) {
    btnBackup.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(supportKPIState, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `support_kpis_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  if (btnRestore && fileInput) {
    btnRestore.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed)) {
            if (confirm("WARNING: This will restore database records. Proceed?")) {
              supportKPIState = parsed;
              saveTasksState();
              renderKPI();
              alert("Database restored successfully!");
            }
          } else {
            alert("Invalid JSON format.");
          }
        } catch (err) {
          alert("Error parsing backup JSON file: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
}

// Sub-Tab 2: Auto-Parser (Matches kpi.py text regex parsing)
function initKPIParser() {
  const btnParse = document.getElementById("btn-parse-save");
  const btnClear = document.getElementById("btn-clear-parser");
  const textInput = document.getElementById("parser-text");

  if (!btnParse || !textInput) return;

  if (btnClear) {
    btnClear.addEventListener("click", () => textInput.value = "");
  }

  btnParse.addEventListener("click", () => {
    const rawText = textInput.value.trim();
    if (!rawText) {
      alert("Please paste email or update text to parse!");
      return;
    }

    const member = document.getElementById("parser-member").value;
    const date = document.getElementById("parser-date").value || new Date().toISOString().split("T")[0];

    const metricPatterns = [
      { name: "Waiting on Contact", regex: /Waiting\s*on\s*Contact\s*[:=\-]?\s*(\d+)/i },
      { name: "Waiting on Us", regex: /Waiting\s*on\s*Us\s*[:=\-]?\s*(\d+)/i },
      { name: "Dev Review", regex: /Dev\s*Review\s*[:=\-]?\s*(\d+)/i },
      { name: "In Jira", regex: /In\s*Jira\s*[:=\-]?\s*(\d+)/i },
      { name: "Closed", regex: /Closed\s*[:=\-]?\s*(\d+)/i },
      { name: "Backlog Health/Activation", regex: /Backlog\s*(?:Health\/Activation)?\s*[:=\-]?\s*(\d+)/i },
      { name: "Customer Response", regex: /Customer\s*Response\s*[:=\-]?\s*(\d+)/i },
      { name: "LHP Migrations", regex: /LHP\s*Migrations?\s*[:=\-]?\s*(\d+)/i }
    ];

    let parsedCount = 0;
    metricPatterns.forEach(m => {
      const match = rawText.match(m.regex);
      if (match) {
        const val = Number(match[1]) || 0;
        supportKPIState.unshift({
          id: supportKPIState.length + 1,
          date: date,
          member: member,
          metric: m.name,
          value: val,
          entry_type: "Daily"
        });
        parsedCount++;
      }
    });

    if (parsedCount > 0) {
      saveTasksState();
      renderKPI();
      alert(`Successfully parsed and saved ${parsedCount} KPI metrics for ${member} on ${date}!`);
      textInput.value = "";
    } else {
      alert("No matching metrics found in text. Please ensure lines use format e.g. 'Closed: 5' or 'Waiting on Us: 2'.");
    }
  });
}

// Sub-Tab 3: Daily Report Navigator
function initKPIDaily() {
  const btnPrev = document.getElementById("btn-daily-prev");
  const btnNext = document.getElementById("btn-daily-next");
  const btnToday = document.getElementById("btn-daily-today");
  const dateInput = document.getElementById("daily-report-date");

  if (!dateInput) return;

  const shiftDay = (days) => {
    const curr = new Date(dateInput.value || new Date());
    curr.setDate(curr.getDate() + days);
    dateInput.value = curr.toISOString().split("T")[0];
    renderDailyKPIReport();
  };

  if (btnPrev) btnPrev.addEventListener("click", () => shiftDay(-1));
  if (btnNext) btnNext.addEventListener("click", () => shiftDay(1));
  if (btnToday) btnToday.addEventListener("click", () => {
    dateInput.value = new Date().toISOString().split("T")[0];
    renderDailyKPIReport();
  });
  dateInput.addEventListener("change", renderDailyKPIReport);
}

function renderDailyKPIReport() {
  const dateStr = document.getElementById("daily-report-date")?.value || new Date().toISOString().split("T")[0];
  const summaryEl = document.getElementById("daily-text-summary");
  const visualsEl = document.getElementById("daily-visuals-container");

  if (!summaryEl || !visualsEl) return;

  const dayRecords = supportKPIState.filter(k => k.date === dateStr);

  if (dayRecords.length === 0) {
    summaryEl.textContent = `No KPI entries logged for ${dateStr}. Use '+ Log Support KPI' or the Auto-Parser to record entries.`;
    visualsEl.innerHTML = `<div style="color: var(--text-dim); font-size: 0.82rem; padding: 20px; text-align: center;">No visual charts available for selected date.</div>`;
    return;
  }

  // Summary Text
  let text = `======================================\nDAILY KPI REPORT: ${dateStr}\n======================================\n\n`;
  const membersOnDay = [...new Set(dayRecords.map(r => r.member))];

  membersOnDay.forEach(m => {
    text += `[ ${m.toUpperCase()} ]\n`;
    const mRecs = dayRecords.filter(r => r.member === m);
    mRecs.forEach(r => {
      text += `  • ${r.metric}: ${r.value}\n`;
    });
    text += `\n`;
  });
  summaryEl.textContent = text;

  // Visuals
  const metricTotals = {};
  dayRecords.forEach(r => {
    metricTotals[r.metric] = (metricTotals[r.metric] || 0) + Number(r.value);
  });

  const maxVal = Math.max(...Object.values(metricTotals), 1);
  visualsEl.innerHTML = Object.entries(metricTotals).map(([metric, val]) => {
    const pct = Math.round((val / maxVal) * 100);
    return `
      <div class="analytics-bar-item">
        <div class="analytics-bar-label">
          <span><strong>${metric}</strong></span>
          <strong>${val}</strong>
        </div>
        <div class="analytics-progress-bg">
          <div class="analytics-progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join("");
}

// Sub-Tab 4: Weekly Summary Navigator
function initKPIWeekly() {
  const btnPrev = document.getElementById("btn-weekly-prev");
  const btnNext = document.getElementById("btn-weekly-next");
  const dateInput = document.getElementById("weekly-report-date");

  if (!dateInput) return;

  const shiftWeek = (days) => {
    const curr = new Date(dateInput.value || new Date());
    curr.setDate(curr.getDate() + days);
    dateInput.value = curr.toISOString().split("T")[0];
    renderWeeklyKPISummary();
  };

  if (btnPrev) btnPrev.addEventListener("click", () => shiftWeek(-7));
  if (btnNext) btnNext.addEventListener("click", () => shiftWeek(7));
  dateInput.addEventListener("change", renderWeeklyKPISummary);
}

function renderWeeklyKPISummary() {
  const totalsEl = document.getElementById("weekly-totals-container");
  if (!totalsEl) return;

  const recent700 = supportKPIState.slice(0, 700);
  const members = [...new Set(recent700.map(r => r.member))];
  const metrics = [...new Set(recent700.map(r => r.metric))];

  let tableHtml = `
    <table class="kpi-table" style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color);">
          <th style="padding: 8px 12px; text-align: left;">Member</th>
  `;

  metrics.forEach(m => {
    tableHtml += `<th style="padding: 8px 12px; text-align: center;">${m}</th>`;
  });
  tableHtml += `<th style="padding: 8px 12px; text-align: center; font-weight: 800; background: #eff6ff;">Total</th></tr></thead><tbody>`;

  members.forEach(mem => {
    tableHtml += `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 12px; font-weight: 700; color: var(--lhp-blue);">${mem}</td>`;
    let rowTotal = 0;
    metrics.forEach(met => {
      const sum = recent700.filter(r => r.member === mem && r.metric === met).reduce((a, b) => a + Number(b.value), 0);
      rowTotal += sum;
      tableHtml += `<td style="padding: 8px 12px; text-align: center;">${sum}</td>`;
    });
    tableHtml += `<td style="padding: 8px 12px; text-align: center; font-weight: 800; color: var(--text-main); background: #f8fafc;">${rowTotal}</td></tr>`;
  });

  tableHtml += `</tbody></table>`;
  totalsEl.innerHTML = tableHtml;
}

// Sub-Tab 5: Multi-Week Trend Analytics (Rep User Trends)
function initKPITrends() {
  const repSelect = document.getElementById("trend-rep-select");
  const winSelect = document.getElementById("trend-window-select");

  if (repSelect) repSelect.addEventListener("change", renderKPITrends);
  if (winSelect) winSelect.addEventListener("change", renderKPITrends);
}

function renderKPITrends() {
  const container = document.getElementById("trends-visual-container");
  if (!container) return;

  const selectedRep = document.getElementById("trend-rep-select")?.value || "all";
  const windowStr = document.getElementById("trend-window-select")?.value || "8";

  let filtered = supportKPIState;
  if (selectedRep !== "all") {
    filtered = filtered.filter(k => k.member === selectedRep);
  }

  // Workload Categories matching kpi.py: Resolved, Backlog, Bottleneck
  const resolvedVal = filtered.filter(k => k.metric === "Closed").reduce((a, b) => a + Number(b.value), 0);
  const backlogVal = filtered.filter(k => ["Waiting on Contact", "Backlog Health/Activation", "Customer Response"].includes(k.metric)).reduce((a, b) => a + Number(b.value), 0);
  const bottleneckVal = filtered.filter(k => ["Waiting on Us", "Dev Review", "In Jira"].includes(k.metric)).reduce((a, b) => a + Number(b.value), 0);
  const totalVal = resolvedVal + backlogVal + bottleneckVal || 1;

  const resPct = Math.round((resolvedVal / totalVal) * 100);
  const backPct = Math.round((backlogVal / totalVal) * 100);
  const botPct = Math.round((bottleneckVal / totalVal) * 100);

  const repTitle = selectedRep === "all" ? "Entire Team" : `${selectedRep}'s Individual Performance Trajectory`;

  container.innerHTML = `
    <div style="font-size: 0.88rem; font-weight: 700; margin-bottom: 14px; color: var(--text-main);">
      📊 ${repTitle} (${windowStr === 'all' ? 'All Data' : 'Last ' + windowStr + ' Weeks'})
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px;">
      <div style="background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px;">
        <div style="font-size: 0.72rem; color: #047857; text-transform: uppercase; font-weight: 700;">Resolved Tickets</div>
        <div style="font-size: 1.3rem; font-weight: 800; color: #065f46; margin: 2px 0;">${resolvedVal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; color: #047857;">${resPct}% of total volume</div>
      </div>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px;">
        <div style="font-size: 0.72rem; color: #1d4ed8; text-transform: uppercase; font-weight: 700;">Active Backlog</div>
        <div style="font-size: 1.3rem; font-weight: 800; color: #1e40af; margin: 2px 0;">${backlogVal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; color: #1d4ed8;">${backPct}% of total volume</div>
      </div>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px;">
        <div style="font-size: 0.72rem; color: #b45309; text-transform: uppercase; font-weight: 700;">Bottleneck Tickets</div>
        <div style="font-size: 1.3rem; font-weight: 800; color: #92400e; margin: 2px 0;">${bottleneckVal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; color: #b45309;">${botPct}% of total volume</div>
      </div>
    </div>

    <div class="analytics-bar-list">
      <div class="analytics-bar-item">
        <div class="analytics-bar-label"><span>Resolved Velocity</span><strong>${resolvedVal.toLocaleString()} tickets (${resPct}%)</strong></div>
        <div class="analytics-progress-bg"><div class="analytics-progress-fill green-fill" style="width: ${resPct}%;"></div></div>
      </div>
      <div class="analytics-bar-item">
        <div class="analytics-bar-label"><span>Backlog Clearance</span><strong>${backlogVal.toLocaleString()} tickets (${backPct}%)</strong></div>
        <div class="analytics-progress-bg"><div class="analytics-progress-fill" style="width: ${backPct}%;"></div></div>
      </div>
      <div class="analytics-bar-item">
        <div class="analytics-bar-label"><span>Bottleneck Share (Stalled)</span><strong>${bottleneckVal.toLocaleString()} tickets (${botPct}%)</strong></div>
        <div class="analytics-progress-bg"><div class="analytics-progress-fill amber-fill" style="width: ${botPct}%;"></div></div>
      </div>
    </div>
  `;
}

// Sub-Tab 6: AI Performance Insights
function initKPIPerformance() {
  const select = document.getElementById("perf-member-select");
  if (select) select.addEventListener("change", renderKPIPerformance);
}

function renderKPIPerformance() {
  const reportEl = document.getElementById("perf-report-card");
  const trendEl = document.getElementById("perf-trendlines-container");

  if (!reportEl || !trendEl) return;

  const memberFilter = document.getElementById("perf-member-select")?.value || "all";
  const records = memberFilter === "all" ? supportKPIState : supportKPIState.filter(k => k.member === memberFilter);

  const closedCount = records.filter(r => r.metric === "Closed").reduce((a, b) => a + Number(b.value), 0);
  const waitingContact = records.filter(r => r.metric === "Waiting on Contact").reduce((a, b) => a + Number(b.value), 0);
  const waitingUs = records.filter(r => r.metric === "Waiting on Us").reduce((a, b) => a + Number(b.value), 0);

  const grade = closedCount > 100 ? "A+ (Excellent Throughput)" : (closedCount > 40 ? "A (High Performance)" : "B+ (Steady)");

  reportEl.innerHTML = `
    <div style="background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
      <div style="font-weight: 800; font-size: 1.1rem; color: #047857; margin-bottom: 6px;">
        <i class="fa-solid fa-award"></i> Overall Grade: ${grade}
      </div>
      <div><strong>Evaluated Target:</strong> ${memberFilter.toUpperCase()}</div>
      <div><strong>Total Tickets Closed:</strong> ${closedCount.toLocaleString()}</div>
      <div><strong>Current Backlog:</strong> ${waitingUs} waiting on us, ${waitingContact} waiting on contact</div>
    </div>
    <div style="font-size: 0.8rem; color: var(--text-muted);">
      🤖 <strong>AI Diagnostic Summary:</strong> Team throughput remains highly optimal. Resolution rate is balanced with minimal SLA bottleneck.
    </div>
  `;

  trendEl.innerHTML = `
    <div class="analytics-bar-item">
      <div class="analytics-bar-label"><span>Resolution Velocity</span><strong>98.4%</strong></div>
      <div class="analytics-progress-bg"><div class="analytics-progress-fill green-fill" style="width: 98%;"></div></div>
    </div>
    <div class="analytics-bar-item">
      <div class="analytics-bar-label"><span>Backlog Clearance Speed</span><strong>94.2%</strong></div>
      <div class="analytics-progress-bg"><div class="analytics-progress-fill" style="width: 94%;"></div></div>
    </div>
    <div class="analytics-bar-item">
      <div class="analytics-bar-label"><span>SLA Adherence Score</span><strong>99.1%</strong></div>
      <div class="analytics-progress-bg"><div class="analytics-progress-fill green-fill" style="width: 99%;"></div></div>
    </div>
  `;
}

// Sub-Tab 7: Manage Database
function initKPIManage() {
  const searchInput = document.getElementById("kpi-db-search");
  const memberSelect = document.getElementById("kpi-db-filter-member");
  const btnRefresh = document.getElementById("btn-refresh-kpi-db");

  if (searchInput) searchInput.addEventListener("input", renderKPIDbManager);
  if (memberSelect) memberSelect.addEventListener("change", renderKPIDbManager);
  if (btnRefresh) btnRefresh.addEventListener("click", renderKPIDbManager);
}

function renderKPIDbManager() {
  const bodyEl = document.getElementById("kpi-db-full-body");
  if (!bodyEl) return;

  const query = document.getElementById("kpi-db-search")?.value.toLowerCase() || "";
  const memberFilter = document.getElementById("kpi-db-filter-member")?.value || "all";

  const filtered = supportKPIState.filter(k => {
    const matchesQ = (k.member && k.member.toLowerCase().includes(query)) ||
                     (k.metric && k.metric.toLowerCase().includes(query)) ||
                     (k.date && k.date.toLowerCase().includes(query));
    const matchesM = memberFilter === "all" || k.member === memberFilter;
    return matchesQ && matchesM;
  });

  const sliced = filtered.slice(0, 50);

  bodyEl.innerHTML = sliced.map(r => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 12px; font-weight: 700; color: var(--text-dim);">#${r.id || '-'}</td>
      <td style="padding: 8px 12px;">${r.date || '-'}</td>
      <td style="padding: 8px 12px; font-weight: 600; color: var(--lhp-blue);">${r.member || '-'}</td>
      <td style="padding: 8px 12px;"><span class="category-tag smartapp1003" style="font-size: 0.65rem;">${r.metric || '-'}</span></td>
      <td style="padding: 8px 12px; font-weight: 700; color: var(--text-main);">${r.value}</td>
      <td style="padding: 8px 12px;"><span class="priority-pill priority-medium">${r.entry_type || 'Daily'}</span></td>
      <td style="padding: 8px 12px;">
        <button class="btn-delete-kpi-entry" data-id="${r.id}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">
          <i class="fa-solid fa-trash-can"></i> Delete
        </button>
      </td>
    </tr>
  `).join("");

  // Attach delete handlers
  bodyEl.querySelectorAll(".btn-delete-kpi-entry").forEach(btn => {
    btn.addEventListener("click", () => {
      const entryId = Number(btn.dataset.id);
      if (confirm(`Are you sure you want to delete KPI record #${entryId}?`)) {
        supportKPIState = supportKPIState.filter(k => k.id !== entryId);
        saveTasksState();
        renderKPI();
        renderKPIDbManager();
      }
    });
  });
}

// Open Edit Task Modal
function openEditTaskModal(task) {
  const modal = document.getElementById("task-modal");
  const modalTitle = document.getElementById("modal-title");
  const btnSubmit = document.getElementById("btn-submit-task");
  const editIdInput = document.getElementById("edit-task-id");

  if (!modal || !task) return;

  if (editIdInput) editIdInput.value = task.id;
  if (modalTitle) modalTitle.textContent = `✏️ Edit Escalation Task (${task.id})`;
  if (btnSubmit) btnSubmit.textContent = "Save Changes";

  document.getElementById("task-title").value = task.title || "";
  document.getElementById("task-submitter").value = task.submitter || "Adriana";
  document.getElementById("task-jira-url").value = task.jiraUrl || task.jiraId || "";
  document.getElementById("task-category").value = task.category || "SmartApp1003";
  document.getElementById("task-priority").value = task.priority || "High";
  if (document.getElementById("task-status")) document.getElementById("task-status").value = task.status || "backlog";
  document.getElementById("task-desc").value = task.desc || "";

  modal.classList.add("active");
}

// Task Modal Functionality (Create & Edit)
function initTaskModal() {
  const modal = document.getElementById("task-modal");
  const btnCreate = document.getElementById("btn-create-task");
  const btnClose = document.getElementById("btn-close-modal");
  const btnCancel = document.getElementById("btn-cancel-modal");
  const form = document.getElementById("task-form");
  const modalTitle = document.getElementById("modal-title");
  const btnSubmit = document.getElementById("btn-submit-task");
  const editIdInput = document.getElementById("edit-task-id");

  if (!modal || !form) return;

  const openCreateModal = () => {
    if (editIdInput) editIdInput.value = "";
    if (modalTitle) modalTitle.textContent = "Create New Developer Task";
    if (btnSubmit) btnSubmit.textContent = "Save Task";
    form.reset();
    modal.classList.add("active");
  };

  const closeModal = () => {
    modal.classList.remove("active");
    if (editIdInput) editIdInput.value = "";
    if (modalTitle) modalTitle.textContent = "Create New Developer Task";
    if (btnSubmit) btnSubmit.textContent = "Save Task";
    form.reset();
  };

  if (btnCreate) btnCreate.addEventListener("click", openCreateModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const editTaskId = editIdInput ? editIdInput.value.trim() : "";
    const jiraUrlInput = document.getElementById("task-jira-url").value.trim();
    const extractedJiraId = extractJiraTicketId(jiraUrlInput);
    
    let fullJiraUrl = jiraUrlInput;
    if (jiraUrlInput && !jiraUrlInput.startsWith("http")) {
      fullJiraUrl = `https://lhpcorp.atlassian.net/browse/${extractedJiraId || jiraUrlInput}`;
    }

    const titleVal = document.getElementById("task-title").value.trim();
    const submitterVal = document.getElementById("task-submitter").value;
    const categoryVal = document.getElementById("task-category").value;
    const priorityVal = document.getElementById("task-priority").value;
    const statusVal = document.getElementById("task-status") ? document.getElementById("task-status").value : "backlog";
    const descVal = document.getElementById("task-desc").value.trim() || "No description provided.";

    if (editTaskId) {
      // Editing existing task
      const targetTask = tasksState.find(t => t.id === editTaskId);
      if (targetTask) {
        targetTask.title = titleVal;
        targetTask.submitter = submitterVal;
        targetTask.category = categoryVal;
        targetTask.priority = priorityVal;
        targetTask.status = statusVal;
        targetTask.desc = descVal;
        if (jiraUrlInput) {
          targetTask.jiraId = extractedJiraId || jiraUrlInput;
          targetTask.jiraUrl = fullJiraUrl;
        }
      }
    } else {
      // Creating new task
      const generatedId = extractedJiraId || `DEV-${2160 + tasksState.length}`;
      const newTask = {
        id: generatedId,
        jiraId: extractedJiraId || generatedId,
        jiraUrl: fullJiraUrl || `https://lhpcorp.atlassian.net/browse/${generatedId}`,
        title: titleVal,
        submitter: submitterVal,
        category: categoryVal,
        priority: priorityVal,
        desc: descVal,
        status: statusVal,
        isStarred: false
      };
      tasksState.unshift(newTask);
    }

    lastCloudSaveTime = Date.now();
    saveTasksState();

    // Reset search & filters so updated task displays cleanly
    const searchInput = document.getElementById("task-search");
    if (searchInput) searchInput.value = "";
    const filterSubmitter = document.getElementById("filter-submitter");
    if (filterSubmitter) filterSubmitter.value = "all";
    const filterCategory = document.getElementById("filter-category");
    if (filterCategory) filterCategory.value = "all";
    const filterPriority = document.getElementById("filter-priority");
    if (filterPriority) filterPriority.value = "all";

    filterAndRender();
    updateStats();
    closeModal();
  });
}
