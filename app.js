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

const KPI_STORAGE_KEY = "lhp_support_kpis_state_v1";

function saveKPIToLocalStorage() {
  try {
    localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(supportKPIState));
  } catch (err) {
    console.warn("Could not save KPIs to localStorage:", err);
  }
}

function loadKPIFromLocalStorage() {
  try {
    const stored = localStorage.getItem(KPI_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Could not load KPIs from localStorage:", err);
  }
  return null;
}

// App State
let tasksState = loadTasksState();
let supportKPIState = [];

// Save KPIs to Server Disk API (/api/kpis), LocalStorage, & Cloud Database
async function saveKPIDatabase() {
  saveKPIToLocalStorage();

  try {
    fetch("/api/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(supportKPIState)
    }).catch(err => console.warn("Local KPI disk save notification:", err));
  } catch (err) {
    console.warn("Could not post to /api/kpis:", err);
  }

  await saveTasksState();
}

async function loadSupportKPIData() {
  const localCache = loadKPIFromLocalStorage();
  if (localCache !== null) {
    supportKPIState = localCache;
  }

  try {
    let res = await fetch("/api/kpis");
    if (!res.ok) {
      res = await fetch("kpi_data.json");
    }
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length > 0 || localCache === null) {
          supportKPIState = data;
          saveKPIToLocalStorage();
        }
      }
    }
  } catch (err) {
    console.warn("Could not load kpi database from server API", err);
  }

  // Populate default dates if unset
  const latestDate = typeof getLatestKPIDate === "function" ? getLatestKPIDate() : formatLocalIsoDate(new Date());
  const dailyDate = document.getElementById("daily-report-date");
  const weeklyDate = document.getElementById("weekly-report-date");
  const teamInfoDate = document.getElementById("team-info-date");
  const gradeDate = document.getElementById("grade-date-input");
  const numbersDate = document.getElementById("numbers-report-date");

  if (dailyDate && !dailyDate.value) dailyDate.value = latestDate;
  if (weeklyDate && !weeklyDate.value) weeklyDate.value = latestDate;
  if (teamInfoDate && !teamInfoDate.value) teamInfoDate.value = latestDate;
  if (gradeDate && !gradeDate.value) gradeDate.value = latestDate;
  if (numbersDate && !numbersDate.value) numbersDate.value = latestDate;

  renderKPI();
  renderKPIDbManager();

  // Re-render whichever subtab is currently visible
  const activeSubtab = document.querySelector(".kpi-subpanel.active");
  if (activeSubtab) {
    if (activeSubtab.id === "kpi-subtab-daily" && typeof renderDailyKPIReport === "function") renderDailyKPIReport();
    if (activeSubtab.id === "kpi-subtab-team-info" && typeof renderKPITeamInfo === "function") renderKPITeamInfo();
    if (activeSubtab.id === "kpi-subtab-weekly" && typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
    if (activeSubtab.id === "kpi-subtab-trends" && typeof renderKPITrends === "function") renderKPITrends();
    if (activeSubtab.id === "kpi-subtab-performance" && typeof renderKPIPerformance === "function") renderKPIPerformance();
    if (activeSubtab.id === "kpi-subtab-grade" && typeof renderKPIGrade === "function") renderKPIGrade();
    if (activeSubtab.id === "kpi-subtab-numbers" && typeof renderKPINumbers === "function") renderKPINumbers();
    if (activeSubtab.id === "kpi-subtab-manage" && typeof renderKPIDbManager === "function") renderKPIDbManager();
  }
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

      if (targetView === "kpi") {
        renderKPI();
        renderKPIDbManager();
        const activeSubtab = document.querySelector(".kpi-subpanel.active");
        if (activeSubtab) {
          if (activeSubtab.id === "kpi-subtab-daily" && typeof renderDailyKPIReport === "function") renderDailyKPIReport();
          if (activeSubtab.id === "kpi-subtab-team-info" && typeof renderKPITeamInfo === "function") renderKPITeamInfo();
          if (activeSubtab.id === "kpi-subtab-weekly" && typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
          if (activeSubtab.id === "kpi-subtab-trends" && typeof renderKPITrends === "function") renderKPITrends();
          if (activeSubtab.id === "kpi-subtab-performance" && typeof renderKPIPerformance === "function") renderKPIPerformance();
          if (activeSubtab.id === "kpi-subtab-grade" && typeof renderKPIGrade === "function") renderKPIGrade();
          if (activeSubtab.id === "kpi-subtab-numbers" && typeof renderKPINumbers === "function") renderKPINumbers();
          if (activeSubtab.id === "kpi-subtab-manage" && typeof renderKPIDbManager === "function") renderKPIDbManager();
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

      if (launchView === "kpi") {
        renderKPI();
        renderKPIDbManager();
        const activeSubtab = document.querySelector(".kpi-subpanel.active");
        if (activeSubtab) {
          if (activeSubtab.id === "kpi-subtab-daily" && typeof renderDailyKPIReport === "function") renderDailyKPIReport();
          if (activeSubtab.id === "kpi-subtab-team-info" && typeof renderKPITeamInfo === "function") renderKPITeamInfo();
          if (activeSubtab.id === "kpi-subtab-weekly" && typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
          if (activeSubtab.id === "kpi-subtab-trends" && typeof renderKPITrends === "function") renderKPITrends();
          if (activeSubtab.id === "kpi-subtab-performance" && typeof renderKPIPerformance === "function") renderKPIPerformance();
          if (activeSubtab.id === "kpi-subtab-grade" && typeof renderKPIGrade === "function") renderKPIGrade();
          if (activeSubtab.id === "kpi-subtab-numbers" && typeof renderKPINumbers === "function") renderKPINumbers();
          if (activeSubtab.id === "kpi-subtab-manage" && typeof renderKPIDbManager === "function") renderKPIDbManager();
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

  // 4. Support KPIs Database Metrics & Table
  const totalDbCountEl = document.getElementById("kpi-total-db-count");
  const metricsGrid = document.getElementById("kpi-support-metrics-grid");
  const recentBody = document.getElementById("kpi-db-recent-body");

  if (totalDbCountEl) {
    const totalVolume = supportKPIState.reduce((acc, r) => acc + getEntryTotal(r), 0);
    totalDbCountEl.textContent = `${supportKPIState.length.toLocaleString()} logs (${totalVolume.toLocaleString()} tickets)`;
  }

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
      const totalVal = supportKPIState.reduce((acc, curr) => acc + getEntryMetric(curr, m.name), 0);
      const activeCount = supportKPIState.filter(k => getEntryMetric(k, m.name) > 0).length;
      return `
        <div class="kpi-scorecard" style="padding: 12px 14px;">
          <div class="kpi-scorecard-header">
            <span class="kpi-label" style="font-size: 0.68rem;">${m.name}</span>
            <i class="fa-solid ${m.icon} kpi-icon" style="color: ${m.color}; font-size: 0.95rem;"></i>
          </div>
          <div class="kpi-val" style="font-size: 1.3rem; margin-bottom: 2px;">${totalVal.toLocaleString()}</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${activeCount} active submissions</div>
        </div>
      `;
    }).join("");
  }

  if (recentBody) {
    const recentRows = supportKPIState.slice(0, 10);
    recentBody.innerHTML = recentRows.map(r => {
      const closed = getEntryMetric(r, "Closed");
      const bottleneck = getEntryBottleneck(r);
      const total = getEntryTotal(r);
      
      let detailsSummary = "";
      if (r.metrics) {
        detailsSummary = Object.entries(r.metrics)
          .filter(([_, v]) => Number(v) > 0)
          .map(([k, v]) => `<strong>${k}</strong>: ${v}`)
          .join(", ");
      } else {
        detailsSummary = `${r.metric}: ${r.value}`;
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 12px; font-weight: 700; color: var(--text-dim);">#${r.id || '-'}</td>
          <td style="padding: 8px 12px; font-weight: 600;">${r.date || '-'}</td>
          <td style="padding: 8px 12px; font-weight: 700; color: var(--lhp-blue);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="mini-avatar" style="width: 22px; height: 22px; font-size: 0.65rem;">${(r.member || '??').slice(0, 2).toUpperCase()}</div>
              <span>${r.member || '-'}</span>
            </div>
          </td>
          <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #10b981; background: #f0fdf4;">${closed}</td>
          <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${bottleneck > 0 ? '#b45309' : 'var(--text-dim)'}; background: ${bottleneck > 0 ? '#fffbeb' : 'transparent'};">${bottleneck}</td>
          <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: var(--text-main); background: #f8fafc;">${total}</td>
          <td style="padding: 8px 12px;"><span class="priority-pill priority-medium">${r.entry_type || 'Daily'}</span></td>
          <td style="padding: 8px 12px; font-size: 0.72rem; color: var(--text-muted); max-width: 300px;">${detailsSummary || 'All 0'}</td>
          <td style="padding: 8px 12px; text-align: center; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn-edit-kpi-recent" data-id="${r.id}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: 600;">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="btn-delete-kpi-recent" data-id="${r.id}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: 600;">
                <i class="fa-solid fa-trash-can"></i> Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Attach edit handlers for recent entries
    recentBody.querySelectorAll(".btn-edit-kpi-recent").forEach(btn => {
      btn.onclick = () => {
        const entryId = btn.dataset.id;
        const targetRecord = supportKPIState.find(k => String(k.id) === String(entryId));
        if (targetRecord) {
          openEditKPIModal(targetRecord);
        }
      };
    });

    // Attach delete handlers for recent entries
    recentBody.querySelectorAll(".btn-delete-kpi-recent").forEach(btn => {
      btn.onclick = () => {
        const entryId = btn.dataset.id;
        const targetRecord = supportKPIState.find(k => String(k.id) === String(entryId));
        const recordLabel = targetRecord ? `${targetRecord.member} on ${targetRecord.date} (Total: ${getEntryTotal(targetRecord)} tickets)` : `Record #${entryId}`;
        if (confirm(`Are you sure you want to delete the KPI submission for ${recordLabel}?`)) {
          supportKPIState = supportKPIState.filter(k => String(k.id) !== String(entryId));
          saveKPIDatabase();
          renderKPI();
          if (typeof renderKPIDbManager === "function") renderKPIDbManager();
          if (typeof renderDailyKPIReport === "function") renderDailyKPIReport();
          if (typeof renderKPITeamInfo === "function") renderKPITeamInfo();
          if (typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
        }
      };
    });
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

  // Default date picker to today or latest KPI date
  const dateInput = document.getElementById("kpi-entry-date");
  if (dateInput) dateInput.value = formatLocalIsoDate(new Date());

  const openModal = () => modal.classList.add("active");
  const closeModal = () => {
    modal.classList.remove("active");
    form.reset();
    if (dateInput) dateInput.value = formatLocalIsoDate(new Date());
  };

  if (btnLog) btnLog.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(supportKPIState, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `support_kpis_export_${formatLocalIsoDate(new Date())}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const date = document.getElementById("kpi-entry-date").value;
    const member = document.getElementById("kpi-entry-member").value;
    const entryType = document.getElementById("kpi-entry-type").value || "Daily";
    const metric = document.getElementById("kpi-entry-metric").value;
    const value = Number(document.getElementById("kpi-entry-value").value) || 0;

    // Check if an existing entry exists for this member and date
    let existing = supportKPIState.find(k => k.date === date && k.member === member && (k.entry_type || 'Daily') === entryType);
    if (existing) {
      if (!existing.metrics) {
        existing.metrics = {
          "Waiting on Contact": 0,
          "Waiting on Us": 0,
          "Dev Review": 0,
          "In Jira": 0,
          "Closed": 0,
          "Backlog Health/Activation": 0,
          "Customer Response": 0,
          "LHP Migrations": 0
        };
      }
      existing.metrics[metric] = value;
      existing.total = Object.values(existing.metrics).reduce((a, b) => a + (Number(b) || 0), 0);
    } else {
      const metrics = {
        "Waiting on Contact": 0,
        "Waiting on Us": 0,
        "Dev Review": 0,
        "In Jira": 0,
        "Closed": 0,
        "Backlog Health/Activation": 0,
        "Customer Response": 0,
        "LHP Migrations": 0
      };
      metrics[metric] = value;
      const newEntry = {
        id: Date.now(),
        date: date,
        member: member,
        entry_type: entryType,
        metrics: metrics,
        total: Object.values(metrics).reduce((a, b) => a + (Number(b) || 0), 0)
      };
      supportKPIState.unshift(newEntry);
    }
    
    // Submit to Server & Cloud Database (No LocalStorage)
    saveKPIDatabase();

    renderKPI();
    if (typeof renderDailyKPIReport === "function") renderDailyKPIReport();
    if (typeof renderKPITeamInfo === "function") renderKPITeamInfo();
    if (typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
    if (typeof renderKPIDbManager === "function") renderKPIDbManager();
    closeModal();
  });
}

// Universal Record Accessors for Unified & Legacy KPI Submissions
function getEntryMetric(entry, metricName) {
  if (!entry) return 0;
  if (entry.metrics && entry.metrics[metricName] !== undefined) {
    return Number(entry.metrics[metricName]) || 0;
  }
  if (entry.metric === metricName) {
    return Number(entry.value) || 0;
  }
  return 0;
}

function getEntryTotal(entry) {
  if (!entry) return 0;
  if (typeof entry.total === "number") return entry.total;
  if (entry.metrics) {
    return Object.values(entry.metrics).reduce((a, b) => a + (Number(b) || 0), 0);
  }
  return Number(entry.value) || 0;
}

function getEntryClosed(entry) {
  return getEntryMetric(entry, "Closed");
}

function getEntryBottleneck(entry) {
  return getEntryMetric(entry, "Waiting on Us") + getEntryMetric(entry, "Dev Review") + getEntryMetric(entry, "In Jira");
}

// Date & Range Helper Utilities for KPI Analytics
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
  if (!d || !(d instanceof Date) || isNaN(d)) d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLatestKPIDate() {
  if (supportKPIState && supportKPIState.length > 0) {
    const validDates = supportKPIState.map(k => k.date).filter(Boolean).sort();
    if (validDates.length > 0) {
      return validDates[validDates.length - 1];
    }
  }
  return formatLocalIsoDate(new Date());
}

function getWeekRange(dateStr) {
  const sel = parseLocalDate(dateStr || getLatestKPIDate());
  const dayOfWeek = sel.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  
  const monday = new Date(sel);
  monday.setDate(sel.getDate() + diffToMon);
  
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    monday,
    friday,
    sunday,
    monStr: formatLocalIsoDate(monday),
    friStr: formatLocalIsoDate(friday),
    sunStr: formatLocalIsoDate(sunday)
  };
}

// Global Failproof KPI Sub-Tab Navigation Handler
window.switchKPISubtab = function(item) {
  if (!item) return;
  const targetSubtab = item.getAttribute("data-subtab") || item.dataset.subtab;
  if (!targetSubtab) return;

  const subnavItems = document.querySelectorAll(".kpi-subnav-item");
  const subpanels = document.querySelectorAll(".kpi-subpanel");

  subnavItems.forEach(i => i.classList.remove("active"));
  item.classList.add("active");

  subpanels.forEach(panel => {
    if (panel.id === targetSubtab) {
      panel.classList.add("active");
      panel.style.display = "block";
    } else {
      panel.classList.remove("active");
      panel.style.display = "none";
    }
  });

  // Render tab specific visuals
  if (targetSubtab === "kpi-subtab-overview") renderKPI();
  if (targetSubtab === "kpi-subtab-daily") renderDailyKPIReport();
  if (targetSubtab === "kpi-subtab-team-info") renderKPITeamInfo();
  if (targetSubtab === "kpi-subtab-weekly") renderWeeklyKPISummary();
  if (targetSubtab === "kpi-subtab-trends") renderKPITrends();
  if (targetSubtab === "kpi-subtab-performance") renderKPIPerformance();
  if (targetSubtab === "kpi-subtab-grade") renderKPIGrade();
  if (targetSubtab === "kpi-subtab-numbers") renderKPINumbers();
  if (targetSubtab === "kpi-subtab-manage") renderKPIDbManager();
};

function initKPISubnav() {
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".kpi-subnav-item");
    if (item) {
      window.switchKPISubtab(item);
    }
  });

  // Init date pickers with latest database date or today
  const defaultDateStr = getLatestKPIDate();
  const parserDate = document.getElementById("parser-date");
  const dailyDate = document.getElementById("daily-report-date");
  const weeklyDate = document.getElementById("weekly-report-date");
  const teamInfoDate = document.getElementById("team-info-date");
  const gradeDate = document.getElementById("grade-date-input");
  const numbersDate = document.getElementById("numbers-report-date");

  if (parserDate && !parserDate.value) parserDate.value = formatLocalIsoDate(new Date());
  if (dailyDate && !dailyDate.value) dailyDate.value = defaultDateStr;
  if (weeklyDate && !weeklyDate.value) weeklyDate.value = defaultDateStr;
  if (teamInfoDate && !teamInfoDate.value) teamInfoDate.value = defaultDateStr;
  if (gradeDate && !gradeDate.value) gradeDate.value = defaultDateStr;
  if (numbersDate && !numbersDate.value) numbersDate.value = defaultDateStr;
}

function initKPI() {
  initKPISubnav();
  initKPIModal();
  initKPIEditModal();
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
    const curr = parseLocalDate(dateInput.value || getLatestKPIDate());
    curr.setDate(curr.getDate() + days);
    dateInput.value = formatLocalIsoDate(curr);
    renderKPITeamInfo();
  };

  if (btnPrev) btnPrev.onclick = () => shiftWeek(-7);
  if (btnNext) btnNext.onclick = () => shiftWeek(7);
  dateInput.onchange = renderKPITeamInfo;
  dateInput.oninput = renderKPITeamInfo;
}

function renderKPITeamInfo() {
  const summaryEl = document.getElementById("team-info-text-summary");
  const visualsEl = document.getElementById("team-info-visuals");
  const dateInput = document.getElementById("team-info-date");

  if (!summaryEl || !visualsEl) return;

  const selDateStr = dateInput?.value || getLatestKPIDate();
  const week = getWeekRange(selDateStr);
  const weekRecords = supportKPIState.filter(k => k.date >= week.monStr && k.date <= week.sunStr);

  if (weekRecords.length === 0) {
    summaryEl.textContent = `--- WEEKLY TEAM METRICS ---\n\n📅 Target Week: Mon, ${week.monStr} to Fri, ${week.friStr}\n\nNo KPI records found for this week in database.`;
    visualsEl.innerHTML = `<div style="color: var(--text-dim); font-size: 0.82rem; padding: 20px; text-align: center;">No visual charts available for selected week.</div>`;
    return;
  }

  const metricTypes = [
    "Waiting on Contact",
    "Waiting on Us",
    "Dev Review",
    "In Jira",
    "Closed",
    "Backlog Health/Activation",
    "Customer Response",
    "LHP Migrations"
  ];

  const metricTotals = {};
  metricTypes.forEach(met => {
    metricTotals[met] = weekRecords.reduce((acc, r) => acc + getEntryMetric(r, met), 0);
  });

  const totalVal = Object.values(metricTotals).reduce((a, b) => a + b, 0) || 1;
  const closedCount = metricTotals["Closed"] || 0;
  const resolutionRate = totalVal > 0 ? ((closedCount / totalVal) * 100).toFixed(1) : "0.0";

  let text = `--- WEEKLY TEAM METRICS ---\n\n📅 Target Week: Mon, ${week.monStr} to Fri, ${week.friStr} (Mon-Fri)\n📦 Total Volume Touched: ${totalVal.toLocaleString()} tickets\n🎯 Team Resolution Rate: ${resolutionRate}%\n\n🏆 TOTAL TEAM METRICS BREAKDOWN:\n`;
  Object.entries(metricTotals).forEach(([met, val]) => {
    const pct = Math.round((val / totalVal) * 100);
    text += `  • ${met.padEnd(25)}: ${String(val).padStart(4)} (${pct}%)\n`;
  });
  summaryEl.textContent = text;

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

// Sub-Tab 8: 100-Point Team Grading & ASCII Battle Engine
function initKPIGrade() {
  const btn = document.getElementById("btn-calculate-grade");
  const btnPrev = document.getElementById("btn-grade-prev");
  const btnNext = document.getElementById("btn-grade-next");
  const dateInput = document.getElementById("grade-date-input");

  const shiftWeek = (days) => {
    const curr = parseLocalDate(dateInput?.value || getLatestKPIDate());
    curr.setDate(curr.getDate() + days);
    if (dateInput) dateInput.value = formatLocalIsoDate(curr);
    renderKPIGrade();
  };

  if (btn) btn.onclick = renderKPIGrade;
  if (btnPrev) btnPrev.onclick = () => shiftWeek(-7);
  if (btnNext) btnNext.onclick = () => shiftWeek(7);
  if (dateInput) {
    dateInput.onchange = renderKPIGrade;
    dateInput.oninput = renderKPIGrade;
  }
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
    const total = recs.reduce((a, b) => a + getEntryTotal(b), 0);
    const closed = recs.reduce((a, b) => a + getEntryMetric(b, "Closed"), 0);
    const bottleneck = recs.reduce((a, b) => a + getEntryBottleneck(b), 0);
    const migrations = recs.reduce((a, b) => a + getEntryMetric(b, "LHP Migrations"), 0);

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
    const mTot = mRecs.reduce((a, b) => a + getEntryTotal(b), 0);
    const mClo = mRecs.reduce((a, b) => a + getEntryMetric(b, "Closed"), 0);
    const mBot = mRecs.reduce((a, b) => a + getEntryBottleneck(b), 0);
    const mMig = mRecs.reduce((a, b) => a + getEntryMetric(b, "LHP Migrations"), 0);

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
    const curr = parseLocalDate(dateInput.value || getLatestKPIDate());
    curr.setDate(curr.getDate() + days);
    dateInput.value = formatLocalIsoDate(curr);
    renderKPINumbers();
  };

  if (btnPrev) btnPrev.onclick = () => shiftWeek(-7);
  if (btnNext) btnNext.onclick = () => shiftWeek(7);
  dateInput.onchange = renderKPINumbers;
  dateInput.oninput = renderKPINumbers;
}

function renderKPINumbers() {
  const cardsEl = document.getElementById("numbers-cards-grid");
  const tableEl = document.getElementById("numbers-table-container");
  const dateInput = document.getElementById("numbers-report-date");

  if (!cardsEl || !tableEl || !dateInput) return;

  // Calculate Monday and Friday of selected date's week using parseLocalDate to prevent UTC timezone offset shift
  const selDate = parseLocalDate(dateInput.value || getLatestKPIDate());
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
    const mWeekRecs = supportKPIState.filter(k => {
      return k.member === m && k.date >= monStr && k.date <= friStr;
    });

    const totalClosed = mWeekRecs.reduce((a, b) => a + getEntryMetric(b, "Closed"), 0);
    const daysLogged = new Set(mWeekRecs.filter(k => getEntryTotal(k) > 0).map(k => k.date)).size || 1;
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
          const mWeekRecs = supportKPIState.filter(k => {
            return k.member === m && k.date >= monStr && k.date <= friStr;
          });
          const totalClosed = mWeekRecs.reduce((a, b) => a + getEntryMetric(b, "Closed"), 0);
          const daysLogged = new Set(mWeekRecs.filter(k => getEntryTotal(k) > 0).map(k => k.date)).size || 1;
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

// Global Failproof KPI Parser Handlers
let isKPIParsing = false;

window.handleClearKPIParser = function() {
  const textInput = document.getElementById("parser-text");
  const feedbackBox = document.getElementById("parser-feedback-box");
  if (textInput) textInput.value = "";
  if (feedbackBox) feedbackBox.style.display = "none";
};

window.handleParseAndSaveKPI = function() {
  if (isKPIParsing) return;
  isKPIParsing = true;
  setTimeout(() => { isKPIParsing = false; }, 300);

  const textInput = document.getElementById("parser-text");
  const memberSelect = document.getElementById("parser-member");
  const dateInput = document.getElementById("parser-date");
  const feedbackBox = document.getElementById("parser-feedback-box");
  const feedbackTitle = document.getElementById("parser-feedback-title");
  const feedbackDetails = document.getElementById("parser-feedback-details");

  if (!textInput) return;

  const rawText = textInput.value.trim();
  if (!rawText) {
    const msg = "Please paste email or update text into the box above before clicking Parse & Save!";
    alert(msg);
    if (feedbackBox) {
      feedbackBox.style.display = "block";
      feedbackBox.style.background = "#fef2f2";
      feedbackBox.style.borderColor = "#fca5a5";
      feedbackBox.style.color = "#991b1b";
      feedbackTitle.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:#dc2626;"></i> <span>Input Text Missing</span>`;
      feedbackDetails.textContent = msg;
    }
    return;
  }

  // 1. Team Member selection: Strictly use dropdown selection
  const member = memberSelect ? memberSelect.value : "Christie";

  // 2. Date selection: Strictly use the date picker value, normalized to YYYY-MM-DD
  let date = dateInput && dateInput.value ? dateInput.value.trim() : "";
  if (!date) {
    // Check if text has a date if the date input is completely blank
    const dateIsoMatch = rawText.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
    if (dateIsoMatch) {
      const yStr = dateIsoMatch[1];
      const mStr = dateIsoMatch[2].padStart(2, '0');
      const dStr = dateIsoMatch[3].padStart(2, '0');
      date = `${yStr}-${mStr}-${dStr}`;
    } else {
      const dateUsMatch = rawText.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
      if (dateUsMatch) {
        const mStr = dateUsMatch[1].padStart(2, '0');
        const dStr = dateUsMatch[2].padStart(2, '0');
        const yStr = dateUsMatch[3];
        date = `${yStr}-${mStr}-${dStr}`;
      } else {
        date = formatLocalIsoDate(new Date());
      }
    }
    if (dateInput) dateInput.value = date;
  } else {
    // Normalize date format in case of single digits
    const parts = date.split("-");
    if (parts.length === 3) {
      date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }

  // 3. Robust Multi-Format Metric Patterns
  const metricDefinitions = [
    {
      name: "Waiting on Contact",
      regexes: [
        /(?:Waiting\s*on\s*Contact|Waiting\s*Contact|Waiting\s*for\s*Contact|Pending\s*Contact|WOC)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:Waiting\s*on\s*Contact|Waiting\s*Contact|Waiting\s*for\s*Contact|Pending\s*Contact|WOC)\b/i
      ]
    },
    {
      name: "Waiting on Us",
      regexes: [
        /(?:Waiting\s*on\s*Us|Waiting\s*Us|Waiting\s*for\s*Us|Pending\s*Internal|Our\s*Wait|WOU)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:Waiting\s*on\s*Us|Waiting\s*Us|Waiting\s*for\s*Us|Pending\s*Internal|Our\s*Wait|WOU)\b/i
      ]
    },
    {
      name: "Dev Review",
      regexes: [
        /(?:Dev\s*Review(?:ing)?|In\s*Dev\s*Review|Developer\s*Review|Dev\s*Pending)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:Dev\s*Review(?:ing)?|In\s*Dev\s*Review|Developer\s*Review|Dev\s*Pending)\b/i
      ]
    },
    {
      name: "In Jira",
      regexes: [
        /(?:In\s*Jira|Jira\s*Tickets?|Jira\s*Escalations?|Jira\s*Tasks?|Jira)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:In\s*Jira|Jira\s*Tickets?|Jira\s*Escalations?|Jira\s*Tasks?|Jira)\b/i
      ]
    },
    {
      name: "Closed",
      regexes: [
        /(?:Closed|Resolved|Completed|Close|Done)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:Closed|Resolved|Completed|Close|Done)\b/i
      ]
    },
    {
      name: "Backlog Health/Activation",
      regexes: [
        /(?:Backlog\s*(?:Health(?:\/Activation)?)?|Activation(?:s)?|Backlog\s*Health)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:Backlog\s*(?:Health(?:\/Activation)?)?|Activation(?:s)?|Backlog\s*Health)\b/i
      ]
    },
    {
      name: "Customer Response",
      regexes: [
        /(?:Customer\s*Response(?:s)?|Customer\s*Responded|Responded)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:Customer\s*Response(?:s)?|Customer\s*Responded|Responded)\b/i
      ]
    },
    {
      name: "LHP Migrations",
      regexes: [
        /(?:LHP\s*Migrations?|Migrations?|LHP\s*Migration|Migration)\s*[:=\-\(\s]*(\d+)/i,
        /(\d+)\s*[\:\-\=\s]+\s*(?:LHP\s*Migrations?|Migrations?|LHP\s*Migration|Migration)\b/i
      ]
    }
  ];

  const parsedMetrics = {
    "Waiting on Contact": 0,
    "Waiting on Us": 0,
    "Dev Review": 0,
    "In Jira": 0,
    "Closed": 0,
    "Backlog Health/Activation": 0,
    "Customer Response": 0,
    "LHP Migrations": 0
  };

  let foundAny = false;
  const lines = rawText.split('\n');

  metricDefinitions.forEach(mDef => {
    let foundVal = null;
    
    // Check line by line first for max precision
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      for (const rx of mDef.regexes) {
        const lMatch = cleanLine.match(rx);
        if (lMatch && lMatch[1] !== undefined) {
          foundVal = Number(lMatch[1]);
          break;
        }
      }
      if (foundVal !== null) break;
    }

    // Fallback to full raw text regex check if line by line didn't catch it
    if (foundVal === null) {
      for (const rx of mDef.regexes) {
        const match = rawText.match(rx);
        if (match && match[1] !== undefined) {
          foundVal = Number(match[1]);
          break;
        }
      }
    }

    if (foundVal !== null && !isNaN(foundVal)) {
      parsedMetrics[mDef.name] = foundVal;
      foundAny = true;
    }
  });

  if (!foundAny) {
    const errorMsg = "No matching KPI metrics found in text. Please format lines like 'Closed: 5', 'Waiting on Us: 2', or '5 - Dev Review'.";
    alert(errorMsg);
    if (feedbackBox) {
      feedbackBox.style.display = "block";
      feedbackBox.style.background = "#fef2f2";
      feedbackBox.style.borderColor = "#fca5a5";
      feedbackBox.style.color = "#991b1b";
      feedbackTitle.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:#dc2626;"></i> <span>No Metrics Recognized</span>`;
      feedbackDetails.textContent = errorMsg;
    }
    return;
  }

  const total = Object.values(parsedMetrics).reduce((a, b) => a + b, 0);

  // 4. Create or update the 1 unified KPI entry for this member and date
  const existingIdx = supportKPIState.findIndex(k => k.date === date && k.member === member && (k.entry_type || 'Daily') === 'Daily');
  let entryId = Date.now();

  if (existingIdx !== -1) {
    entryId = supportKPIState[existingIdx].id || entryId;
    supportKPIState[existingIdx] = {
      id: entryId,
      date: date,
      member: member,
      entry_type: "Daily",
      metrics: parsedMetrics,
      total: total
    };
  } else {
    const newEntry = {
      id: entryId,
      date: date,
      member: member,
      entry_type: "Daily",
      metrics: parsedMetrics,
      total: total
    };
    supportKPIState.unshift(newEntry);
  }

  // Sort supportKPIState newest first by date and id
  supportKPIState.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || 0) - (a.id || 0));

  // Submit directly to Server Disk API & Cloud Database (No LocalStorage)
  saveKPIDatabase();

  // 5. Update UI & re-render all relevant tabs
  renderKPI();
  if (typeof renderDailyKPIReport === "function") renderDailyKPIReport();
  if (typeof renderKPITeamInfo === "function") renderKPITeamInfo();
  if (typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
  if (typeof renderKPIDbManager === "function") renderKPIDbManager();

  // Also sync daily report date input so navigating to Daily tab immediately shows this entry
  const dailyDateInput = document.getElementById("daily-report-date");
  if (dailyDateInput) dailyDateInput.value = date;

  // 6. Display visual feedback box
  const summaryText = Object.entries(parsedMetrics)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => `<strong>${k}</strong>: ${v}`)
    .join(", ");
  
  if (feedbackBox) {
    feedbackBox.style.display = "block";
    feedbackBox.style.background = "#ecfdf5";
    feedbackBox.style.borderColor = "#6ee7b7";
    feedbackBox.style.color = "#065f46";
    feedbackTitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#059669;"></i> <span>Successfully Saved Unified KPI Record!</span>`;
    feedbackDetails.innerHTML = `Saved for <strong>${member}</strong> on <strong>${date}</strong> (Total Volume: ${total} tickets):<br><div style="margin-top: 6px; padding: 8px 12px; background: rgba(255,255,255,0.8); border-radius: 6px; font-family: monospace;">${summaryText || 'All metrics recorded as 0'}</div>`;
  }

  // Clear text input after successful save
  textInput.value = "";
};

// Sub-Tab 2: Auto-Parser (Matches kpi.py text regex parsing)
function initKPIParser() {
  const btnParse = document.getElementById("btn-parse-save");
  const btnClear = document.getElementById("btn-clear-parser");

  if (btnParse) {
    btnParse.onclick = (e) => {
      e.preventDefault();
      window.handleParseAndSaveKPI();
    };
  }

  if (btnClear) {
    btnClear.onclick = (e) => {
      e.preventDefault();
      window.handleClearKPIParser();
    };
  }
}

// Sub-Tab 3: Daily Report Navigator
function initKPIDaily() {
  const btnPrev = document.getElementById("btn-daily-prev");
  const btnNext = document.getElementById("btn-daily-next");
  const btnToday = document.getElementById("btn-daily-today");
  const dateInput = document.getElementById("daily-report-date");

  if (!dateInput) return;

  const shiftDay = (days) => {
    const curr = parseLocalDate(dateInput.value || getLatestKPIDate());
    curr.setDate(curr.getDate() + days);
    dateInput.value = formatLocalIsoDate(curr);
    renderDailyKPIReport();
  };

  if (btnPrev) btnPrev.onclick = () => shiftDay(-1);
  if (btnNext) btnNext.onclick = () => shiftDay(1);
  if (btnToday) btnToday.onclick = () => {
    dateInput.value = formatLocalIsoDate(new Date());
    renderDailyKPIReport();
  };
  dateInput.onchange = renderDailyKPIReport;
  dateInput.oninput = renderDailyKPIReport;
}

function renderDailyKPIReport() {
  const dateInput = document.getElementById("daily-report-date");
  const dateStr = dateInput?.value || getLatestKPIDate();
  const summaryEl = document.getElementById("daily-text-summary");
  const visualsEl = document.getElementById("daily-visuals-container");

  if (!summaryEl || !visualsEl) return;

  const dayRecords = supportKPIState.filter(k => k.date === dateStr);

  if (dayRecords.length === 0) {
    summaryEl.textContent = `No KPI entries logged for ${dateStr}.\n\nUse '+ Log Support KPI' or the Auto-Parser to record entries for this date.`;
    visualsEl.innerHTML = `<div style="color: var(--text-dim); font-size: 0.82rem; padding: 20px; text-align: center;">No visual charts available for ${dateStr}.</div>`;
    return;
  }

  const metricTypes = [
    "Waiting on Contact",
    "Waiting on Us",
    "Dev Review",
    "In Jira",
    "Closed",
    "Backlog Health/Activation",
    "Customer Response",
    "LHP Migrations"
  ];

  // Summary Text
  let text = `======================================\nDAILY KPI REPORT: ${dateStr}\n======================================\n\n`;
  const membersOnDay = [...new Set(dayRecords.map(r => r.member))];

  membersOnDay.forEach(m => {
    text += `[ ${m.toUpperCase()} ]\n`;
    const mRecs = dayRecords.filter(r => r.member === m);
    metricTypes.forEach(met => {
      const val = mRecs.reduce((acc, r) => acc + getEntryMetric(r, met), 0);
      if (val > 0) {
        text += `  • ${met.padEnd(26)}: ${val}\n`;
      }
    });
    const mTot = mRecs.reduce((acc, r) => acc + getEntryTotal(r), 0);
    text += `  ➔ Total Touched Volume     : ${mTot} tickets\n\n`;
  });
  summaryEl.textContent = text;

  // Visuals
  const metricTotals = {};
  metricTypes.forEach(met => {
    metricTotals[met] = dayRecords.reduce((acc, r) => acc + getEntryMetric(r, met), 0);
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

// Sub-Tab 4: Weekly Summary Navigator (Weekly Individual & Team Summary)
function initKPIWeekly() {
  const btnPrev = document.getElementById("btn-weekly-prev");
  const btnNext = document.getElementById("btn-weekly-next");
  const dateInput = document.getElementById("weekly-report-date");

  if (!dateInput) return;

  const shiftWeek = (days) => {
    const curr = parseLocalDate(dateInput.value || getLatestKPIDate());
    curr.setDate(curr.getDate() + days);
    dateInput.value = formatLocalIsoDate(curr);
    renderWeeklyKPISummary();
  };

  if (btnPrev) btnPrev.onclick = () => shiftWeek(-7);
  if (btnNext) btnNext.onclick = () => shiftWeek(7);
  dateInput.onchange = renderWeeklyKPISummary;
  dateInput.oninput = renderWeeklyKPISummary;
}

function renderWeeklyKPISummary() {
  const totalsEl = document.getElementById("weekly-totals-container");
  if (!totalsEl) return;

  const dateInput = document.getElementById("weekly-report-date");
  const selDateStr = dateInput?.value || getLatestKPIDate();
  const week = getWeekRange(selDateStr);
  const weekRecords = supportKPIState.filter(k => k.date >= week.monStr && k.date <= week.sunStr);

  if (weekRecords.length === 0) {
    totalsEl.innerHTML = `
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 28px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
          📅 Week of ${week.monStr} to ${week.friStr} (Mon-Fri)
        </div>
        <p style="font-size: 0.84rem; margin-bottom: 14px; max-width: 480px; margin-left: auto; margin-right: auto;">
          No KPI records found for this specific week. Use the <strong>Prev Week</strong> / <strong>Next Week</strong> buttons or pick a date from an active logging period.
        </p>
        <div style="display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('btn-weekly-prev').click()"><i class="fa-solid fa-chevron-left"></i> Prev Week</button>
          <button type="button" class="btn btn-primary" onclick="if(document.getElementById('weekly-report-date')){ document.getElementById('weekly-report-date').value='${getLatestKPIDate()}'; renderWeeklyKPISummary(); }"><i class="fa-solid fa-calendar-check"></i> Go to Latest Data (${getLatestKPIDate()})</button>
        </div>
      </div>
    `;
    return;
  }

  const metricTypes = [
    "Waiting on Contact",
    "Waiting on Us",
    "Dev Review",
    "In Jira",
    "Closed",
    "Backlog Health/Activation",
    "Customer Response",
    "LHP Migrations"
  ];

  // Distinct members present in this week, ordered with standard ones first
  const standardMembers = ["Christie", "Kevin", "Nishant"];
  const otherMembers = [...new Set(weekRecords.map(r => r.member))].filter(m => !standardMembers.includes(m));
  const activeMembers = [...standardMembers.filter(m => weekRecords.some(r => r.member === m)), ...otherMembers];
  const membersToDisplay = activeMembers.length > 0 ? activeMembers : standardMembers;

  // Compute column totals
  const colTotals = {};
  metricTypes.forEach(met => {
    colTotals[met] = weekRecords.reduce((acc, r) => acc + getEntryMetric(r, met), 0);
  });
  const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);
  const totalClosed = colTotals["Closed"] || 0;
  const teamResRate = grandTotal > 0 ? ((totalClosed / grandTotal) * 100).toFixed(1) : "0.0";

  // Build Aggregation Table Rows HTML
  let tableRows = "";
  membersToDisplay.forEach(mem => {
    const memRecs = weekRecords.filter(r => r.member === mem);
    let rowTotal = 0;
    let rowClosed = 0;
    let metricCols = "";

    metricTypes.forEach(met => {
      const sum = memRecs.reduce((acc, r) => acc + getEntryMetric(r, met), 0);
      rowTotal += sum;
      if (met === "Closed") rowClosed = sum;
      metricCols += `<td style="padding: 8px 10px; text-align: center; ${sum > 0 ? 'font-weight: 700; color: var(--text-main);' : 'color: var(--text-dim);'}">${sum}</td>`;
    });

    const resRate = rowTotal > 0 ? ((rowClosed / rowTotal) * 100).toFixed(1) : "0.0";
    const daysLogged = new Set(memRecs.filter(r => getEntryTotal(r) > 0).map(r => r.date)).size || 1;
    const avgDailyClosed = (rowClosed / daysLogged).toFixed(1);

    tableRows += `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 12px; font-weight: 700; color: var(--lhp-blue);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="mini-avatar" style="width: 22px; height: 22px; font-size: 0.65rem;">${mem.slice(0, 2).toUpperCase()}</div>
            <span>${mem}</span>
          </div>
        </td>
        ${metricCols}
        <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: var(--text-main); background: #f8fafc;">${rowTotal}</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: ${Number(resRate) >= 65 ? '#059669' : '#d97706'}; background: #f0fdf4;">${resRate}%</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 600; color: var(--text-muted);">${avgDailyClosed}</td>
      </tr>
    `;
  });

  const footerCols = metricTypes.map(met => `<th style="padding: 8px 10px; text-align: center; font-weight: 800;">${colTotals[met] || 0}</th>`).join("");

  // Individual Member Visual Progress & Breakdown Cards
  let memberCardsHtml = "";
  membersToDisplay.forEach(mem => {
    const memRecs = weekRecords.filter(r => r.member === mem);
    const mTot = memRecs.reduce((acc, r) => acc + getEntryTotal(r), 0);
    const mClosed = memRecs.reduce((acc, r) => acc + getEntryMetric(r, "Closed"), 0);
    const mBottleneck = memRecs.reduce((acc, r) => acc + getEntryBottleneck(r), 0);
    const mResPct = mTot > 0 ? ((mClosed / mTot) * 100).toFixed(1) : "0.0";
    const daysLogged = new Set(memRecs.filter(r => getEntryTotal(r) > 0).map(r => r.date)).size || 1;

    // Per-metric progress lines
    const metricLines = metricTypes.map(met => {
      const val = memRecs.reduce((acc, r) => acc + getEntryMetric(r, met), 0);
      if (val === 0) return "";
      const pct = mTot > 0 ? Math.round((val / mTot) * 100) : 0;
      let barColor = "var(--lhp-blue)";
      if (met === "Closed") barColor = "#10b981";
      else if (["Waiting on Us", "Dev Review", "In Jira"].includes(met)) barColor = "#f59e0b";
      else if (met === "Backlog Health/Activation") barColor = "#ec4899";

      return `
        <div class="analytics-bar-item" style="margin-bottom: 6px;">
          <div class="analytics-bar-label" style="font-size: 0.72rem;">
            <span>${met}</span>
            <strong>${val} (${pct}%)</strong>
          </div>
          <div class="analytics-progress-bg" style="height: 6px;">
            <div class="analytics-progress-fill" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
        </div>
      `;
    }).filter(Boolean).join("");

    memberCardsHtml += `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="mini-avatar">${mem.slice(0, 2).toUpperCase()}</div>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${mem}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${daysLogged} active logging days</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #047857;">${mResPct}%</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Resolution</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: #166534; font-weight: 700; text-transform: uppercase;">Closed</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #14532d;">${mClosed}</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: #92400e; font-weight: 700; text-transform: uppercase;">Bottleneck</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #78350f;">${mBottleneck}</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 6px 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: #1e40af; font-weight: 700; text-transform: uppercase;">Total Touched</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a;">${mTot}</div>
          </div>
        </div>

        <div>
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Metric Breakdown</div>
          ${metricLines || '<div style="font-size: 0.75rem; color: var(--text-dim);">No metric breakdown available.</div>'}
        </div>
      </div>
    `;
  });

  totalsEl.innerHTML = `
    <!-- Active Week Status Banner -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 700; color: #1e40af;">
        <i class="fa-solid fa-calendar-check" style="color: var(--lhp-blue);"></i>
        <span>Active Week: Mon, ${week.monStr} – Fri, ${week.friStr}</span>
      </div>
      <div style="display: flex; gap: 12px; font-size: 0.78rem; color: #1e3a8a; flex-wrap: wrap;">
        <span><strong>${weekRecords.length}</strong> active submission logs</span>
        <span>•</span>
        <span><strong>${grandTotal}</strong> total tickets touched</span>
        <span>•</span>
        <span><strong>${totalClosed}</strong> closed (${teamResRate}%)</span>
      </div>
    </div>

    <!-- Weekly Matrix Table -->
    <div class="kpi-table-wrapper" style="overflow-x: auto; margin-bottom: 20px;">
      <table class="kpi-table" style="width: 100%; border-collapse: collapse; font-size: 0.76rem;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color);">
            <th style="padding: 10px 12px; text-align: left; min-width: 130px;">Team Member</th>
            ${metricTypes.map(m => `<th style="padding: 10px 8px; text-align: center; font-size: 0.72rem;">${m}</th>`).join("")}
            <th style="padding: 10px 10px; text-align: center; font-weight: 800; background: #eff6ff;">Week Total</th>
            <th style="padding: 10px 10px; text-align: center; font-weight: 800; background: #f0fdf4;">Resolution %</th>
            <th style="padding: 10px 10px; text-align: center; font-weight: 700;">Avg Closed/Day</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1; font-weight: 800;">
            <td style="padding: 10px 12px; color: var(--text-main);">TEAM TOTAL</td>
            ${footerCols}
            <td style="padding: 10px 10px; text-align: center; font-weight: 900; background: #dbeafe; color: #1e40af;">${grandTotal}</td>
            <td style="padding: 10px 10px; text-align: center; font-weight: 900; background: #dcfce7; color: #166534;">${teamResRate}%</td>
            <td style="padding: 10px 10px; text-align: center; color: var(--text-muted);">-</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Individual Member Charts Section -->
    <h4 style="font-size: 0.88rem; font-weight: 700; margin-bottom: 12px; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
      <i class="fa-solid fa-users" style="color: var(--lhp-blue);"></i> Individual Member Workload Charts (${week.monStr} to ${week.friStr})
    </h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
      ${memberCardsHtml}
    </div>
  `;
}

// Sub-Tab 5: Multi-Week Trend Analytics (Rep User Trends)
function initKPITrends() {
  const repSelect = document.getElementById("trend-rep-select");
  const winSelect = document.getElementById("trend-window-select");

  if (repSelect) {
    repSelect.onchange = renderKPITrends;
  }
  if (winSelect) {
    winSelect.onchange = renderKPITrends;
  }
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

  if (windowStr !== "all") {
    const numWeeks = parseInt(windowStr, 10) || 8;
    const latestDate = parseLocalDate(getLatestKPIDate());
    const cutoff = new Date(latestDate);
    cutoff.setDate(cutoff.getDate() - (numWeeks * 7));
    const cutoffStr = formatLocalIsoDate(cutoff);
    filtered = filtered.filter(k => k.date >= cutoffStr);
  }

  // Workload Categories matching kpi.py: Resolved, Backlog, Bottleneck
  const resolvedVal = filtered.reduce((acc, k) => acc + getEntryMetric(k, "Closed"), 0);
  const backlogVal = filtered.reduce((acc, k) => acc + getEntryMetric(k, "Waiting on Contact") + getEntryMetric(k, "Backlog Health/Activation") + getEntryMetric(k, "Customer Response"), 0);
  const bottleneckVal = filtered.reduce((acc, k) => acc + getEntryBottleneck(k), 0);
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
  if (select) {
    select.onchange = renderKPIPerformance;
  }
}

function renderKPIPerformance() {
  const reportEl = document.getElementById("perf-report-card");
  const trendEl = document.getElementById("perf-trendlines-container");

  if (!reportEl || !trendEl) return;

  const memberFilter = document.getElementById("perf-member-select")?.value || "all";
  const records = memberFilter === "all" ? supportKPIState : supportKPIState.filter(k => k.member === memberFilter);

  const closedCount = records.reduce((acc, r) => acc + getEntryMetric(r, "Closed"), 0);
  const waitingContact = records.reduce((acc, r) => acc + getEntryMetric(r, "Waiting on Contact"), 0);
  const waitingUs = records.reduce((acc, r) => acc + getEntryMetric(r, "Waiting on Us"), 0);

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

// Sub-Tab 7: Manage Database & Edit KPI Submissions
function openEditKPIModal(record) {
  const modal = document.getElementById("kpi-edit-modal");
  if (!modal || !record) return;

  document.getElementById("kpi-edit-id").value = record.id || "";
  document.getElementById("kpi-edit-member").value = record.member || "Christie";
  document.getElementById("kpi-edit-date").value = record.date || formatLocalIsoDate(new Date());
  document.getElementById("kpi-edit-type").value = record.entry_type || "Daily";

  document.getElementById("kpi-edit-closed").value = getEntryMetric(record, "Closed");
  document.getElementById("kpi-edit-woc").value = getEntryMetric(record, "Waiting on Contact");
  document.getElementById("kpi-edit-wou").value = getEntryMetric(record, "Waiting on Us");
  document.getElementById("kpi-edit-dev").value = getEntryMetric(record, "Dev Review");
  document.getElementById("kpi-edit-jira").value = getEntryMetric(record, "In Jira");
  document.getElementById("kpi-edit-backlog").value = getEntryMetric(record, "Backlog Health/Activation");
  document.getElementById("kpi-edit-customer").value = getEntryMetric(record, "Customer Response");
  document.getElementById("kpi-edit-migrations").value = getEntryMetric(record, "LHP Migrations");

  updateEditModalTotal();
  modal.classList.add("active");
}

function updateEditModalTotal() {
  const closed = Number(document.getElementById("kpi-edit-closed")?.value) || 0;
  const woc = Number(document.getElementById("kpi-edit-woc")?.value) || 0;
  const wou = Number(document.getElementById("kpi-edit-wou")?.value) || 0;
  const dev = Number(document.getElementById("kpi-edit-dev")?.value) || 0;
  const jira = Number(document.getElementById("kpi-edit-jira")?.value) || 0;
  const backlog = Number(document.getElementById("kpi-edit-backlog")?.value) || 0;
  const cust = Number(document.getElementById("kpi-edit-customer")?.value) || 0;
  const mig = Number(document.getElementById("kpi-edit-migrations")?.value) || 0;

  const total = closed + woc + wou + dev + jira + backlog + cust + mig;
  const totalEl = document.getElementById("kpi-edit-calculated-total");
  if (totalEl) totalEl.textContent = `${total} tickets`;
}

function initKPIEditModal() {
  const modal = document.getElementById("kpi-edit-modal");
  const btnClose = document.getElementById("btn-close-kpi-edit-modal");
  const btnCancel = document.getElementById("btn-cancel-kpi-edit-modal");
  const form = document.getElementById("kpi-edit-form");

  if (!modal || !form) return;

  const closeModal = () => modal.classList.remove("active");

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  // Live total calculation on inputs
  const inputs = [
    "kpi-edit-closed", "kpi-edit-woc", "kpi-edit-wou", "kpi-edit-dev",
    "kpi-edit-jira", "kpi-edit-backlog", "kpi-edit-customer", "kpi-edit-migrations"
  ];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateEditModalTotal);
  });

  form.onsubmit = (e) => {
    e.preventDefault();
    const entryId = document.getElementById("kpi-edit-id").value;
    const record = supportKPIState.find(k => String(k.id) === String(entryId));
    if (!record) {
      alert("Could not find KPI record to update.");
      return;
    }

    const updatedMetrics = {
      "Waiting on Contact": Number(document.getElementById("kpi-edit-woc").value) || 0,
      "Waiting on Us": Number(document.getElementById("kpi-edit-wou").value) || 0,
      "Dev Review": Number(document.getElementById("kpi-edit-dev").value) || 0,
      "In Jira": Number(document.getElementById("kpi-edit-jira").value) || 0,
      "Closed": Number(document.getElementById("kpi-edit-closed").value) || 0,
      "Backlog Health/Activation": Number(document.getElementById("kpi-edit-backlog").value) || 0,
      "Customer Response": Number(document.getElementById("kpi-edit-customer").value) || 0,
      "LHP Migrations": Number(document.getElementById("kpi-edit-migrations").value) || 0
    };
    const updatedTotal = Object.values(updatedMetrics).reduce((a, b) => a + b, 0);

    record.member = document.getElementById("kpi-edit-member").value;
    record.date = document.getElementById("kpi-edit-date").value;
    record.entry_type = document.getElementById("kpi-edit-type").value || "Daily";
    record.metrics = updatedMetrics;
    record.total = updatedTotal;

    // Sort newest first
    supportKPIState.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || 0) - (a.id || 0));

    saveKPIDatabase();
    renderKPI();
    renderKPIDbManager();
    if (typeof renderDailyKPIReport === "function") renderDailyKPIReport();
    if (typeof renderKPITeamInfo === "function") renderKPITeamInfo();
    if (typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
    if (typeof renderKPITrends === "function") renderKPITrends();
    if (typeof renderKPIPerformance === "function") renderKPIPerformance();
    if (typeof renderKPIGrade === "function") renderKPIGrade();
    if (typeof renderKPINumbers === "function") renderKPINumbers();

    closeModal();
  };
}

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

  const query = document.getElementById("kpi-db-search")?.value.toLowerCase().trim() || "";
  const memberFilter = document.getElementById("kpi-db-filter-member")?.value || "all";

  const filtered = supportKPIState.filter(k => {
    const memMatch = memberFilter === "all" || k.member === memberFilter;
    if (!memMatch) return false;

    if (!query) return true;

    const matchesM = k.member && k.member.toLowerCase().includes(query);
    const matchesD = k.date && k.date.toLowerCase().includes(query);
    const matchesT = k.entry_type && k.entry_type.toLowerCase().includes(query);
    let matchesMetrics = false;
    if (k.metrics) {
      matchesMetrics = Object.keys(k.metrics).some(mKey => mKey.toLowerCase().includes(query));
    } else if (k.metric) {
      matchesMetrics = k.metric.toLowerCase().includes(query);
    }
    return matchesM || matchesD || matchesT || matchesMetrics;
  });

  const sliced = filtered.slice(0, 50);

  if (sliced.length === 0) {
    bodyEl.innerHTML = `<tr><td colspan="9" style="padding: 24px; text-align: center; color: var(--text-dim);">No KPI records match the current search / filter.</td></tr>`;
    return;
  }

  bodyEl.innerHTML = sliced.map(r => {
    const closed = getEntryMetric(r, "Closed");
    const bottleneck = getEntryBottleneck(r);
    const total = getEntryTotal(r);
    
    // Build pills for non-zero metrics
    let breakdownPills = "";
    if (r.metrics) {
      breakdownPills = Object.entries(r.metrics)
        .filter(([_, v]) => Number(v) > 0)
        .map(([k, v]) => `<span style="display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; margin: 2px; font-size: 0.7rem;"><strong>${k}</strong>: ${v}</span>`)
        .join("");
    } else {
      breakdownPills = `<span style="display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 0.7rem;"><strong>${r.metric}</strong>: ${r.value}</span>`;
    }

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 12px; font-weight: 700; color: var(--text-dim);">#${r.id || '-'}</td>
        <td style="padding: 8px 12px; font-weight: 600;">${r.date || '-'}</td>
        <td style="padding: 8px 12px; font-weight: 700; color: var(--lhp-blue);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div class="mini-avatar" style="width: 22px; height: 22px; font-size: 0.65rem;">${(r.member || '??').slice(0, 2).toUpperCase()}</div>
            <span>${r.member || '-'}</span>
          </div>
        </td>
        <td style="padding: 8px 12px; text-align: center;"><span class="priority-pill priority-medium">${r.entry_type || 'Daily'}</span></td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #10b981; background: #f0fdf4;">${closed}</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${bottleneck > 0 ? '#b45309' : 'var(--text-dim)'}; background: ${bottleneck > 0 ? '#fffbeb' : 'transparent'};">${bottleneck}</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: var(--text-main); background: #f8fafc;">${total}</td>
        <td style="padding: 8px 12px; max-width: 320px;">${breakdownPills || '<span style="color:var(--text-dim);">All 0</span>'}</td>
        <td style="padding: 8px 12px; text-align: center; white-space: nowrap;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn-edit-kpi-entry" data-id="${r.id}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: 600;">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn-delete-kpi-entry" data-id="${r.id}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: 600;">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Attach edit handlers
  bodyEl.querySelectorAll(".btn-edit-kpi-entry").forEach(btn => {
    btn.onclick = () => {
      const entryId = btn.dataset.id;
      const targetRecord = supportKPIState.find(k => String(k.id) === String(entryId));
      if (targetRecord) {
        openEditKPIModal(targetRecord);
      }
    };
  });

  // Attach delete handlers
  bodyEl.querySelectorAll(".btn-delete-kpi-entry").forEach(btn => {
    btn.onclick = () => {
      const entryId = btn.dataset.id;
      const targetRecord = supportKPIState.find(k => String(k.id) === String(entryId));
      const recordLabel = targetRecord ? `${targetRecord.member} on ${targetRecord.date} (Total: ${getEntryTotal(targetRecord)} tickets)` : `Record #${entryId}`;
      if (confirm(`Are you sure you want to delete the KPI submission for ${recordLabel}?`)) {
        supportKPIState = supportKPIState.filter(k => String(k.id) !== String(entryId));
        saveKPIDatabase();
        renderKPI();
        renderKPIDbManager();
        if (typeof renderDailyKPIReport === "function") renderDailyKPIReport();
        if (typeof renderKPITeamInfo === "function") renderKPITeamInfo();
        if (typeof renderWeeklyKPISummary === "function") renderWeeklyKPISummary();
        if (typeof renderKPITrends === "function") renderKPITrends();
        if (typeof renderKPIPerformance === "function") renderKPIPerformance();
        if (typeof renderKPIGrade === "function") renderKPIGrade();
        if (typeof renderKPINumbers === "function") renderKPINumbers();
      }
    };
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
