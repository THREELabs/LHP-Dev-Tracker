/**
 * LHP-Dev-Tracker Core JavaScript Application
 * LenderHomePage Development & Sprint Tracker
 */

// Initial Seed Data for LHP Engineering Tasks
const initialTasks = [
  {
    id: "LHP-101",
    title: "Implement Real-time Rate Table API Integration",
    category: "Integrations",
    priority: "Urgent",
    status: "in-progress",
    assignee: "Kevin Webber",
    points: 8,
    desc: "Connect LenderHomePage rate engine with live mortgage rate feeder API and cache results in Redis."
  },
  {
    id: "LHP-102",
    title: "Refactor Digital Mortgage Application Wizard",
    category: "Frontend",
    priority: "High",
    status: "in-progress",
    assignee: "Sarah Jenkins",
    points: 5,
    desc: "Modernize multi-step loan application form UI with glassmorphism design system & instant validation."
  },
  {
    id: "LHP-103",
    title: "Optimize Lead Management Webhook Pipeline",
    category: "LHP Core",
    priority: "High",
    status: "review",
    assignee: "Alex Chen",
    points: 5,
    desc: "Reduce webhook processing latency from 450ms to <80ms for incoming CRM lead notifications."
  },
  {
    id: "LHP-104",
    title: "LOS Partner Authentication & SSO Upgrade",
    category: "Backend API",
    priority: "Urgent",
    status: "review",
    assignee: "Kevin Webber",
    points: 8,
    desc: "Upgrade OAuth2/OIDC provider integration for Encompass and BytePro LOS integrations."
  },
  {
    id: "LHP-105",
    title: "Automated Document Upload OCR Processing",
    category: "Integrations",
    priority: "Medium",
    status: "backlog",
    assignee: "Marcus Vance",
    points: 13,
    desc: "Implement AWS Textract parser for automatic W-2 and paystub verification."
  },
  {
    id: "LHP-106",
    title: "Borrower Portal Mobile Responsive Audit",
    category: "Frontend",
    priority: "Medium",
    status: "backlog",
    assignee: "Sarah Jenkins",
    points: 3,
    desc: "Ensure touch compliance and responsive layout adjustments across iOS & Android viewports."
  },
  {
    id: "LHP-107",
    title: "CI/CD Pipeline Parallel Execution Setup",
    category: "DevOps & CI/CD",
    priority: "Medium",
    status: "completed",
    assignee: "Alex Chen",
    points: 5,
    desc: "Migrate GitHub Actions workflows to parallel test suites, cutting build times by 60%."
  },
  {
    id: "LHP-108",
    title: "Security & Vulnerability Patching (Q3)",
    category: "LHP Core",
    priority: "High",
    status: "completed",
    assignee: "Marcus Vance",
    points: 3,
    desc: "Update core dependencies and pass annual penetration audit checks."
  }
];

// Open Pull Requests Data
const pullRequests = [
  {
    id: "PR-342",
    repo: "LHP-Core-API",
    title: "feat(auth): Add Encompass OAuth2 SSO refresh token handling",
    author: "Kevin Webber",
    status: "Review Needed",
    comments: 4,
    updated: "2 hours ago"
  },
  {
    id: "PR-341",
    repo: "LHP-Frontend-Web",
    title: "refactor(wizard): Glassmorphism step navigation components",
    author: "Sarah Jenkins",
    status: "Approved",
    comments: 8,
    updated: "4 hours ago"
  },
  {
    id: "PR-340",
    repo: "LHP-Lead-Pipeline",
    title: "perf(webhooks): Async queue batching for CRM sync",
    author: "Alex Chen",
    status: "Review Needed",
    comments: 2,
    updated: "Yesterday"
  }
];

// Team Members Data
const teamMembers = [
  {
    name: "Kevin Webber",
    role: "Lead Engineer",
    initials: "KW",
    activeTasks: 2,
    completedPoints: 24,
    status: "In Deep Work"
  },
  {
    name: "Sarah Jenkins",
    role: "Senior UI/UX Engineer",
    initials: "SJ",
    activeTasks: 2,
    completedPoints: 18,
    status: "Available"
  },
  {
    name: "Alex Chen",
    role: "Backend & Systems Arch",
    initials: "AC",
    activeTasks: 2,
    completedPoints: 22,
    status: "Reviewing Code"
  },
  {
    name: "Marcus Vance",
    role: "Full Stack Engineer",
    initials: "MV",
    activeTasks: 2,
    completedPoints: 16,
    status: "Available"
  }
];

// App State
let tasksState = [...initialTasks];

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initSearchAndFilters();
  initModal();
  renderBoard();
  renderTeam();
  renderPRs();
  updateStats();
});

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
  const filterAssignee = document.getElementById("filter-assignee");
  const filterPriority = document.getElementById("filter-priority");

  // Keyboard shortcut '/' to search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  searchInput.addEventListener("input", filterAndRender);
  filterAssignee.addEventListener("change", filterAndRender);
  filterPriority.addEventListener("change", filterAndRender);
}

function filterAndRender() {
  const query = document.getElementById("task-search").value.toLowerCase();
  const assigneeFilter = document.getElementById("filter-assignee").value;
  const priorityFilter = document.getElementById("filter-priority").value;

  const filtered = tasksState.filter(task => {
    const matchesQuery = task.title.toLowerCase().includes(query) ||
                         task.desc.toLowerCase().includes(query) ||
                         task.id.toLowerCase().includes(query) ||
                         task.assignee.toLowerCase().includes(query);
    const matchesAssignee = assigneeFilter === "all" || task.assignee === assigneeFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

    return matchesQuery && matchesAssignee && matchesPriority;
  });

  renderBoard(filtered);
}

// Render Kanban Board Cards
function renderBoard(tasksToRender = tasksState) {
  const containers = {
    "backlog": document.getElementById("container-backlog"),
    "in-progress": document.getElementById("container-in-progress"),
    "review": document.getElementById("container-review"),
    "completed": document.getElementById("container-completed")
  };

  const counts = {
    "backlog": 0,
    "in-progress": 0,
    "review": 0,
    "completed": 0
  };

  // Clear containers
  Object.values(containers).forEach(container => {
    if (container) container.innerHTML = "";
  });

  tasksToRender.forEach(task => {
    if (containers[task.status]) {
      counts[task.status]++;
      const card = createTaskCardElement(task);
      containers[task.status].appendChild(card);
    }
  });

  // Update counts
  document.getElementById("count-backlog").textContent = counts["backlog"];
  document.getElementById("count-in-progress").textContent = counts["in-progress"];
  document.getElementById("count-review").textContent = counts["review"];
  document.getElementById("count-completed").textContent = counts["completed"];
}

// Create Card DOM Element
function createTaskCardElement(task) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.setAttribute("draggable", "true");
  card.dataset.id = task.id;

  const getInitials = (name) => name.split(" ").map(n => n[0]).join("");
  const categoryClass = task.category.toLowerCase().replace(/[^a-z]/g, "");

  card.innerHTML = `
    <div class="task-card-header">
      <span class="category-tag ${categoryClass}">${task.category}</span>
      <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
    </div>
    <div class="task-title">${task.title}</div>
    <div class="task-desc">${task.desc}</div>
    <div class="task-card-footer">
      <div class="assignee-info">
        <div class="mini-avatar">${getInitials(task.assignee)}</div>
        <span class="assignee-name">${task.assignee}</span>
      </div>
      <span class="points-tag">${task.points} pts</span>
    </div>
  `;

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
    container.style.background = "rgba(99, 102, 241, 0.1)";
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
      renderBoard();
      updateStats();
    }
  });
});

// Render Team Cards
function renderTeam() {
  const grid = document.getElementById("team-cards-grid");
  if (!grid) return;

  grid.innerHTML = teamMembers.map(m => `
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
          <div style="font-weight: 700; font-size: 1.1rem; color: var(--accent-cyan);">${m.activeTasks}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-size: 0.75rem;">Sprint Points</div>
          <div style="font-weight: 700; font-size: 1.1rem; color: var(--accent-green);">${m.completedPoints}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-size: 0.75rem;">Status</div>
          <div style="font-weight: 600; font-size: 0.85rem; color: var(--accent-indigo);">${m.status}</div>
        </div>
      </div>
    </div>
  `).join("");
}

// Render PR List
function renderPRs() {
  const prWrapper = document.getElementById("pr-list-wrapper");
  if (!prWrapper) return;

  document.getElementById("pr-count-badge").textContent = pullRequests.length;

  prWrapper.innerHTML = pullRequests.map(pr => `
    <div class="pr-card">
      <div class="pr-title-group">
        <i class="fa-solid fa-code-pull-request pr-icon"></i>
        <div class="pr-info">
          <h4>[${pr.repo}] ${pr.title}</h4>
          <p>Opened by <strong>${pr.author}</strong> &bull; ${pr.updated} &bull; ${pr.comments} comments</p>
        </div>
      </div>
      <span class="pr-status-badge ${pr.status === 'Approved' ? 'approved' : 'review-needed'}">
        ${pr.status}
      </span>
    </div>
  `).join("");
}

// Update Top Stat Cards
function updateStats() {
  const total = tasksState.length;
  const inProgress = tasksState.filter(t => t.status === "in-progress" || t.status === "review").length;
  const completed = tasksState.filter(t => t.status === "completed").length;

  document.getElementById("stat-total-tasks").textContent = total;
  document.getElementById("stat-in-progress").textContent = inProgress;
  document.getElementById("stat-completed").textContent = completed;

  const percentage = Math.round((completed / total) * 100) || 0;
  document.getElementById("sprint-progress-bar").style.width = `${percentage}%`;
}

// Task Modal Functionality
function initModal() {
  const modal = document.getElementById("task-modal");
  const btnCreate = document.getElementById("btn-create-task");
  const btnClose = document.getElementById("btn-close-modal");
  const btnCancel = document.getElementById("btn-cancel-modal");
  const form = document.getElementById("task-form");

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
    const newTask = {
      id: `LHP-${100 + tasksState.length + 1}`,
      title: document.getElementById("task-title").value,
      category: document.getElementById("task-category").value,
      priority: document.getElementById("task-priority").value,
      assignee: document.getElementById("task-assignee").value,
      points: parseInt(document.getElementById("task-points").value) || 3,
      desc: document.getElementById("task-desc").value || "No description provided.",
      status: "backlog"
    };

    tasksState.unshift(newTask);
    renderBoard();
    updateStats();
    closeModal();
  });
}
