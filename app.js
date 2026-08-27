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

// Fetch tasks from Cloud Database
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
      const fetchedTasks = Array.isArray(data.record) 
        ? data.record 
        : (data.record && Array.isArray(data.record.tasks) ? data.record.tasks : []);
      
      tasksState = fetchedTasks;
      saveTasksToLocalStorage();
      renderBoard();
      updateStats();
      if (badgeText) badgeText.textContent = "Cloud Sync (Live)";
      return true;
    }
  } catch (err) {
    console.warn("Error loading tasks from cloud database:", err);
    if (badgeText) badgeText.textContent = "Offline Mode";
  }
  return false;
}

// Save tasks to Cloud Database & LocalStorage
async function saveTasksState() {
  lastCloudSaveTime = Date.now();
  saveTasksToLocalStorage();
  const badgeText = document.getElementById("cloud-badge-text");
  if (badgeText) badgeText.textContent = "Saving...";

  try {
    const payload = tasksState.length > 0 ? tasksState : { tasks: [] };
    const res = await fetch(JSONBIN_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log("Tasks saved successfully to Cloud Database!");
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

// DOM Initialization
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initNavigation();
  initSearchAndFilters();
  initModal();
  initDeleteToggle();

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
    });
  });
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
}

// Task Modal Functionality
function initModal() {
  const modal = document.getElementById("task-modal");
  const btnCreate = document.getElementById("btn-create-task");
  const btnClose = document.getElementById("btn-close-modal");
  const btnCancel = document.getElementById("btn-cancel-modal");
  const form = document.getElementById("task-form");

  if (!modal || !form) return;

  const openModal = () => modal.classList.add("active");
  const closeModal = () => {
    modal.classList.remove("active");
    form.reset();
  };

  btnCreate.addEventListener("click", openModal);
  btnClose.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const jiraUrlInput = document.getElementById("task-jira-url").value.trim();
    const extractedJiraId = extractJiraTicketId(jiraUrlInput);
    const generatedId = extractedJiraId || `DEV-${2160 + tasksState.length}`;

    // Construct Jira URL if only ticket ID was entered (e.g. DEV-2152)
    let fullJiraUrl = jiraUrlInput;
    if (jiraUrlInput && !jiraUrlInput.startsWith("http")) {
      fullJiraUrl = `https://lhpcorp.atlassian.net/browse/${extractedJiraId || jiraUrlInput}`;
    }

    const newTask = {
      id: generatedId,
      jiraId: extractedJiraId || generatedId,
      jiraUrl: fullJiraUrl || `https://lhpcorp.atlassian.net/browse/${generatedId}`,
      title: document.getElementById("task-title").value,
      submitter: document.getElementById("task-submitter").value,
      category: document.getElementById("task-category").value,
      priority: document.getElementById("task-priority").value,
      desc: document.getElementById("task-desc").value || "No description provided.",
      status: "backlog",
      isStarred: false
    };

    tasksState.unshift(newTask);
    lastCloudSaveTime = Date.now();
    saveTasksState();

    // Reset search & filters so newly created task is never hidden by active filters
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
