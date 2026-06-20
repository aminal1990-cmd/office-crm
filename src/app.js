import { PERMISSIONS, ROLES as DEFAULT_ROLES } from "./data.js";
import { clearSession, loadSession, loadState, saveSession, saveState, uid } from "./store.js";
import { isCloudConfigured, loadCloudState, saveCloudState } from "./cloud.js";

const app = document.querySelector("#app");

const stages = [
  { key: "lead", label: "سرنخ" },
  { key: "proposal", label: "پیشنهاد" },
  { key: "negotiation", label: "مذاکره" },
  { key: "won", label: "برده شده" }
];

const routeLabels = {
  dashboard: "داشبورد مدیریتی",
  customers: "CRM و ثبت لاگ مشتری",
  kanban: "کانبان فروش و پیگیری",
  reports: "نمودارها و گزارش‌ها",
  letters: "نامه‌نگاری داخلی و چاپ",
  chat: "چت داخلی کارکنان",
  tasks: "تسک‌های کارکنان",
  users: "کاربران و دسترسی‌ها",
  settings: "تنظیمات شرکت"
};

let state = normalizeState(loadState());
let sessionUserId = loadSession();
let route = new URLSearchParams(window.location.search).get("route") || "dashboard";
if (!routeLabels[route]) route = "dashboard";
let modal = null;
let search = "";
let usersTab = "users";
let tasksTab = "all";
let replyToChatId = null;
let activeChatTarget = "public";
let chatSearch = "";
let serviceWorkerRegistration = null;
let cloudStatus = isCloudConfigured() ? "در حال اتصال به دیتابیس آنلاین..." : "";

registerPwa();
initCloudState();

function normalizeState(nextState) {
  return {
    settings: {
      companyName: "نام شرکت شما",
      brandShort: "CRM",
      slogan: "اتوماسیون اداری و مدیریت مشتری",
      registrationNo: "",
      nationalId: "",
      phone: "",
      email: "",
      address: "",
      managerName: "",
      defaultFont: "Vazirmatn, Vazir, Tahoma, Arial, sans-serif",
      primaryColor: "#116a7b",
      dashboardWidgets: ["metrics", "calendar", "tasks", "pipeline", "logs"],
      dashboardNote: "",
      letterHeader: "به نام خدا",
      letterFooter: "این نامه به صورت سیستمی تولید شده است.",
      ...(nextState.settings || {})
    },
    roles: nextState.roles || DEFAULT_ROLES,
    users: (nextState.users?.length ? nextState.users : [{
      id: "u1",
      name: "مدیر سیستم",
      email: "admin@demo.local",
      password: "admin123",
      role: "admin",
      active: true,
      phone: "",
      title: "مدیر سیستم",
      bio: ""
    }]).map((user) => ({ phone: "", title: "", bio: "", ...user })),
    customers: nextState.customers || [],
    deals: nextState.deals || [],
    letters: nextState.letters || nextState.documents || [],
    chats: nextState.chats || [],
    tasks: nextState.tasks || [],
    taskLogs: nextState.taskLogs || [],
    activityLogs: nextState.activityLogs || [],
    logs: nextState.logs || []
  };
}

function currentUser() {
  return state.users.find((user) => user.id === sessionUserId) || null;
}

function can(permission) {
  const user = currentUser();
  if (!user || !user.active) return false;
  return roleByKey(user.role)?.permissions.includes(permission);
}

function roleByKey(key) {
  return state.roles[key] || DEFAULT_ROLES[key] || null;
}

function roleLabel(key) {
  return roleByKey(key)?.label || "نقش نامشخص";
}

function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js")
    .then((registration) => {
      serviceWorkerRegistration = registration;
    })
    .catch(() => {
      serviceWorkerRegistration = null;
    });
}

function notificationStatusLabel() {
  if (!("Notification" in window)) return "اعلان پشتیبانی نمی‌شود";
  if (Notification.permission === "granted") return "اعلان فعال است";
  if (Notification.permission === "denied") return "اعلان مسدود است";
  return "فعال‌سازی اعلان";
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("مرورگر شما از اعلان پشتیبانی نمی‌کند.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    showAppNotification("اعلان فعال شد", "از این به بعد پایه اعلان‌های چت و تسک آماده است.");
  } else {
    alert("برای دریافت اعلان باید اجازه Notification را در مرورگر فعال کنید.");
  }
  render();
}

function showAppNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const payload = { title, body };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SHOW_NOTIFICATION", payload });
    return;
  }
  if (serviceWorkerRegistration?.active) {
    serviceWorkerRegistration.active.postMessage({ type: "SHOW_NOTIFICATION", payload });
    return;
  }
  new Notification(title, { body, icon: "./assets/icon.svg", dir: "rtl", lang: "fa-IR" });
}

function userAvatar(user, className = "avatar") {
  const name = user?.name || "کاربر";
  if (user?.avatar) return `<img class="${className} is-image" src="${escapeHtml(user.avatar)}" alt="${escapeHtml(name)}" />`;
  return `<span class="${className}">${escapeHtml(name.slice(0, 1))}</span>`;
}

function isSystemAdmin() {
  return currentUser()?.role === "admin";
}

function formatMoney(value) {
  return new Intl.NumberFormat("fa-IR").format(Number(value || 0)) + " ریال";
}

function todayFa() {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function nowDateTimeFa() {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function logActivity(text) {
  const user = currentUser();
  state.activityLogs = [{
    id: uid("act"),
    text,
    user: user?.name || "سیستم",
    dateTime: nowDateTimeFa()
  }, ...(state.activityLogs || [])].slice(0, 80);
}

function persist() {
  saveState(state);
  saveCloudState(state).catch(() => {
    cloudStatus = "ذخیره آنلاین ناموفق بود؛ نسخه محلی ذخیره شد.";
    render();
  });
  applySettings();
  render();
}

function setModal(nextModal) {
  modal = nextModal;
  render();
}

async function initCloudState() {
  if (!isCloudConfigured()) return;

  try {
    const onlineState = await loadCloudState();
    if (onlineState) {
      state = normalizeState(onlineState);
      saveState(state);
      cloudStatus = "دیتابیس آنلاین وصل است.";
    } else {
      await saveCloudState(state);
      cloudStatus = "دیتابیس آنلاین ساخته و آماده شد.";
    }
  } catch {
    cloudStatus = "اتصال دیتابیس آنلاین برقرار نشد؛ حالت محلی فعال است.";
  }
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applySettings() {
  document.documentElement.style.setProperty("--primary", state.settings.primaryColor || "#116a7b");
  document.documentElement.style.setProperty("--app-font", state.settings.defaultFont || "Vazirmatn, Vazir, Tahoma, Arial, sans-serif");
}

function notificationCount(key) {
  const user = currentUser();
  if (!user) return 0;
  if (key === "tasks") return state.tasks.filter((task) => task.assigneeId === user.id && task.status !== "انجام شده").length;
  if (key === "chat") {
    return state.chats.filter((message) => isUnreadForUser(message, user.id)).length;
  }
  return 0;
}

function isUnreadForUser(message, userId) {
  const canSee = message.visibility === "public" || message.recipientId === userId;
  return canSee && message.senderId !== userId && !(message.readBy || []).includes(userId);
}

function isActiveChatMessage(message, userId) {
  if (activeChatTarget === "public") return message.visibility === "public";
  return message.visibility === "private" && message.senderId === activeChatTarget && message.recipientId === userId;
}

function markActiveChatRead() {
  const user = currentUser();
  if (!user) return;

  let changed = false;
  state.chats = state.chats.map((message) => {
    if (!isUnreadForUser(message, user.id) || !isActiveChatMessage(message, user.id)) return message;
    changed = true;
    return { ...message, readBy: [...(message.readBy || []), user.id] };
  });

  if (changed) saveState(state);
}

function render() {
  applySettings();
  const user = currentUser();
  if (!user) {
    renderLogin();
    return;
  }

  if (!can(route)) route = roleByKey(user.role)?.permissions[0] || "dashboard";
  if (route === "chat") markActiveChatRead();

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">${escapeHtml(state.settings.brandShort || "CRM")}</div>
          <div>
            <strong>${escapeHtml(state.settings.companyName)}</strong>
            <div class="eyebrow">${escapeHtml(state.settings.slogan)}</div>
          </div>
        </div>
        <div class="sidebar-profile">
          <button class="sidebar-avatar-button" data-action="edit-profile" title="ویرایش پروفایل">
            ${userAvatar(user, "sidebar-avatar")}
          </button>
          <div class="sidebar-profile-info">
            <strong>${escapeHtml(user.name)}</strong>
            <span>${roleLabel(user.role)}</span>
          </div>
          <div class="sidebar-profile-actions">
            <button class="icon-button light-icon" data-action="edit-profile" title="ویرایش پروفایل">⌾</button>
            <button class="icon-button light-icon" data-action="logout" title="خروج">⏻</button>
          </div>
        </div>
        <nav class="nav">
          ${navButton("dashboard", "نمای کلی")}
          ${navButton("customers", "CRM")}
          ${navButton("kanban", "کانبان")}
          ${navButton("reports", "نمودارها")}
          ${navButton("letters", "نامه‌ها")}
          ${navButton("chat", "چت داخلی", notificationCount("chat"))}
          ${navButton("tasks", "تسک‌ها", notificationCount("tasks"))}
          ${navButton("users", "کاربران")}
          ${navButton("settings", "تنظیمات")}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h2>${routeLabels[route]}</h2>
            <div class="eyebrow">اطلاعات خام است؛ همه مشتریان، نامه‌ها و فرصت‌ها را خودتان وارد می‌کنید.</div>
            ${cloudStatus ? `<div class="cloud-status">${escapeHtml(cloudStatus)}</div>` : ""}
          </div>
          <div class="toolbar">${renderRouteActions()}</div>
        </header>
        ${renderRoute()}
      </main>
    </div>
    ${renderModal()}
  `;

  if (route === "chat") {
    requestAnimationFrame(() => {
      const chatList = document.querySelector(".chat-list");
      if (chatList) chatList.scrollTop = chatList.scrollHeight;
    });
  }
}

function navButton(key, label, count = 0) {
  if (!can(key)) return "";
  return `<button class="${route === key ? "active" : ""}" data-route="${key}"><span>${label}</span>${count ? `<b class="nav-badge">${new Intl.NumberFormat("fa-IR").format(count)}</b>` : ""}</button>`;
}

function renderLogin() {
  app.innerHTML = `
    <section class="auth-shell">
      <form class="login-card" data-form="login">
        <div class="brand">
          <div class="brand-mark">${escapeHtml(state.settings.brandShort || "CRM")}</div>
          <div>
            <h1>${escapeHtml(state.settings.companyName)}</h1>
            <div class="eyebrow">${escapeHtml(state.settings.slogan)}</div>
          </div>
        </div>
        <label class="field">
          <span>ایمیل</span>
          <input class="input" name="email" value="admin@demo.local" autocomplete="username" />
        </label>
        <label class="field">
          <span>رمز عبور</span>
          <input class="input" name="password" value="admin123" type="password" autocomplete="current-password" />
        </label>
        <button class="button" style="width:100%">ورود</button>
        <div class="demo-note">مدیر اولیه برای ورود: admin@demo.local / admin123. بعد از ورود از بخش کاربران تغییرش دهید.</div>
      </form>
    </section>
  `;
}

function renderRouteActions() {
  if (route === "customers") {
    return `
      <input class="input" data-action="search" placeholder="جستجوی مشتری..." value="${escapeHtml(search)}" />
      <button class="button" data-action="new-customer">ثبت مشتری</button>
    `;
  }
  if (route === "kanban") return `<button class="button" data-action="new-deal">فرصت جدید</button>`;
  if (route === "letters") return `<button class="button" data-action="new-letter">نامه جدید</button>`;
  if (route === "tasks") return `<button class="button" data-action="new-task">تسک جدید</button>`;
  if (route === "dashboard") return `<button class="button secondary" data-action="enable-notifications">${notificationStatusLabel()}</button><button class="button secondary" data-action="dashboard-settings">ویرایش داشبورد</button>`;
  if (route === "users" && can("users")) return `<button class="button secondary" data-action="new-role">نقش جدید</button><button class="button" data-action="new-user">کاربر جدید</button>`;
  if (route === "settings") return `<button class="button" data-action="save-settings-external">ذخیره تنظیمات</button>`;
  return "";
}

function renderRoute() {
  if (route === "dashboard") return renderDashboard();
  if (route === "customers") return renderCustomers();
  if (route === "kanban") return renderKanban();
  if (route === "reports") return renderReports();
  if (route === "letters") return renderLetters();
  if (route === "chat") return renderChat();
  if (route === "tasks") return renderTasks();
  if (route === "users") return renderUsers();
  if (route === "settings") return renderSettings();
  return "";
}

function renderDashboard() {
  const pipeline = state.deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const won = state.deals.filter((deal) => deal.stage === "won").reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const activeLetters = state.letters.filter((letter) => letter.status !== "بایگانی شده").length;
  const openTaskItems = state.tasks.filter((task) => task.status !== "انجام شده");
  const openTasks = openTaskItems.length;
  const widgets = state.settings.dashboardWidgets || ["metrics", "calendar", "tasks", "pipeline", "logs"];

  return `
    ${widgets.includes("metrics") ? `
      <section class="grid cols-4">
        ${metric("مشتریان", state.customers.length, "ثبت شده در CRM")}
        ${metric("ارزش فرصت‌ها", formatMoney(pipeline), "کل قیف فروش")}
        ${metric("فروش قطعی", formatMoney(won), "مرحله برده شده")}
        ${metric("تسک‌های باز", openTasks, "در جریان")}
      </section>
    ` : ""}
    <section class="grid cols-2" style="margin-top:16px">
      ${dashboardPanel("پیشرفت کار", "بر اساس وضعیت تسک‌ها", progressChart())}
      ${widgets.includes("calendar") ? dashboardPanel("تقویم امروز", "شمسی و میلادی در کنار هم", calendarWidget()) : ""}
      ${widgets.includes("tasks") ? dashboardPanel("تسک‌های باز", "تسک‌های انجام‌شده در داشبورد نمایش داده نمی‌شوند", taskList(openTaskItems.slice(0, 6), true)) : ""}
      ${widgets.includes("pipeline") ? dashboardPanel("قیف فروش", "بر اساس مبلغ", barChart(stageValues())) : ""}
      ${widgets.includes("logs") ? dashboardPanel("آخرین لاگ‌های CRM", "فعالیت‌های ثبت شده", activityList()) : ""}
      ${dashboardPanel("ردپای فعالیت‌ها", "آخرین کارهای انجام‌شده در اتوماسیون", activityFeed())}
      ${widgets.includes("letters") ? dashboardPanel("نامه‌های فعال", "داخلی و اداری", `<div class="empty"><strong>${activeLetters}</strong><p>نامه فعال در سیستم وجود دارد.</p></div>`) : ""}
      ${widgets.includes("note") ? dashboardPanel("بخش سفارشی", "متن قابل ویرایش مدیر", `<p class="dashboard-note">${escapeHtml(state.settings.dashboardNote || "متن سفارشی داشبورد را از ویرایش داشبورد وارد کنید.")}</p>`) : ""}
    </section>
  `;
}

function metric(label, value, hint) {
  return `<div class="card metric"><span>${label}</span><strong>${value}</strong><span>${hint}</span></div>`;
}

function dashboardPanel(title, hint, body) {
  return `
    <div class="panel">
      <div class="panel-header"><strong>${title}</strong><span class="eyebrow">${hint}</span></div>
      <div class="panel-body">${body}</div>
    </div>
  `;
}

function calendarWidget() {
  const today = new Date();
  const faFull = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(today);
  const enFull = new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(today);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() + index);
    return {
      faDay: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "2-digit" }).format(day),
      faWeek: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short" }).format(day),
      enDay: new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(day)
    };
  });

  return `
    <div class="calendar-widget">
      <div class="calendar-today">
        <strong>${faFull}</strong>
        <span>${enFull}</span>
      </div>
      <div class="calendar-days">
        ${days.map((day, index) => `
          <div class="${index === 0 ? "active" : ""}">
            <span>${day.faWeek}</span>
            <strong>${day.faDay}</strong>
            <small>${day.enDay}</small>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function activityFeed() {
  if (!state.activityLogs?.length) return `<div class="empty">هنوز فعالیتی ثبت نشده است.</div>`;
  return `
    <div class="activity-feed">
      ${state.activityLogs.slice(0, 8).map((item) => `
        <div>
          <span>${escapeHtml(item.text)}</span>
          <small>${escapeHtml(item.user)} / ${escapeHtml(item.dateTime)}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCustomers() {
  const term = search.trim().toLowerCase();
  const rows = state.customers.filter((customer) => {
    const content = `${customer.name} ${customer.contact} ${customer.phone} ${customer.status}`.toLowerCase();
    return content.includes(term);
  });

  if (!rows.length) {
    return `
      <div class="panel empty">
        <div>
          <strong>هنوز مشتری ثبت نشده است.</strong>
          <p>از دکمه «ثبت مشتری» شروع کنید. بعد از ثبت، می‌توانید برای هر مشتری لاگ تماس، جلسه، یادداشت و پیگیری بنویسید.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>نام مشتری</th><th>رابط</th><th>تماس</th><th>بخش</th><th>وضعیت</th><th>مالک</th><th>ارزش</th><th>لاگ</th><th>عملیات</th>
            </tr>
          </thead>
          <tbody>${rows.map(customerRow).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function customerRow(customer) {
  const count = state.logs.filter((log) => log.customerId === customer.id).length;
  return `
    <tr>
      <td><strong>${escapeHtml(customer.name)}</strong><div class="eyebrow">${escapeHtml(customer.email)}</div></td>
      <td>${escapeHtml(customer.contact)}</td>
      <td>${escapeHtml(customer.phone)}</td>
      <td><span class="badge">${escapeHtml(customer.segment)}</span></td>
      <td>${statusBadge(customer.status)}</td>
      <td>${escapeHtml(customer.owner)}</td>
      <td>${formatMoney(customer.value)}</td>
      <td><button class="button secondary" data-action="open-logs" data-id="${customer.id}">${count} لاگ</button></td>
      <td><button class="icon-button" title="ویرایش" data-action="edit-customer" data-id="${customer.id}">✎</button></td>
    </tr>
  `;
}

function statusBadge(status) {
  const className = status === "فعال" ? "success" : status === "در مذاکره" ? "warning" : status === "غیرفعال" ? "danger" : "";
  return `<span class="badge ${className}">${escapeHtml(status || "جدید")}</span>`;
}

function renderKanban() {
  return `
    <div class="kanban">
      ${stages.map((stage) => `
        <section class="column" data-stage="${stage.key}">
          <h3>${stage.label}<span class="badge">${state.deals.filter((deal) => deal.stage === stage.key).length}</span></h3>
          ${state.deals.filter((deal) => deal.stage === stage.key).map(dealCard).join("") || `<div class="empty">بدون فرصت</div>`}
        </section>
      `).join("")}
    </div>
  `;
}

function dealCard(deal) {
  const customer = state.customers.find((item) => item.id === deal.customerId);
  return `
    <article class="deal-card" draggable="true" data-deal-id="${deal.id}">
      <strong>${escapeHtml(deal.title)}</strong>
      <div class="deal-meta">
        <span>${escapeHtml(customer?.name || "بدون مشتری")}</span>
        <span>${formatMoney(deal.amount)}</span>
        <span>موعد: ${escapeHtml(deal.dueDate)}</span>
      </div>
      <div class="deal-meta">
        <span class="badge ${deal.priority === "بالا" ? "danger" : deal.priority === "متوسط" ? "warning" : ""}">${escapeHtml(deal.priority)}</span>
        <span>${escapeHtml(deal.owner)}</span>
      </div>
      <div class="deal-actions">
        <span class="eyebrow">برای جابه‌جایی کارت را بکشید</span>
        <button class="icon-button" title="مرحله قبل" data-action="move-deal" data-dir="-1" data-id="${deal.id}">‹</button>
        <button class="icon-button" title="مرحله بعد" data-action="move-deal" data-dir="1" data-id="${deal.id}">›</button>
        <button class="icon-button" title="ویرایش" data-action="edit-deal" data-id="${deal.id}">✎</button>
        <button class="icon-button danger-icon" title="حذف" data-action="delete-deal" data-id="${deal.id}">×</button>
      </div>
    </article>
  `;
}

function renderTasks() {
  const user = currentUser();
  const myTasks = state.tasks.filter((task) => task.assigneeId === user.id);
  return `
    <section class="tasks-columns">
      <div class="panel">
        <div class="panel-header"><strong>همه تسک‌ها</strong><span class="eyebrow">نمای کلی سازمان</span></div>
        <div class="panel-body">${taskList(state.tasks, false)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><strong>تسک‌های من</strong><span class="eyebrow">کارهای مربوط به ${escapeHtml(user.name)}</span></div>
        <div class="panel-body">${taskList(myTasks, false)}</div>
      </div>
    </section>
  `;
}

function taskList(tasks, compact) {
  if (!tasks.length) return `<div class="empty">هنوز تسکی ثبت نشده است.</div>`;
  return `
    <div class="task-list ${compact ? "compact" : ""}">
      ${tasks.map((task) => {
        const assignee = state.users.find((user) => user.id === task.assigneeId);
        const logs = taskTimeline(task.id);
        return `
          <article class="task-card ${taskClass(task)}" data-task-id="${task.id}" title="برای ویرایش دبل‌کلیک کنید">
            <div>
              <strong>${escapeHtml(task.title)}</strong>
              <div class="eyebrow">مسئول: ${escapeHtml(assignee?.name || "نامشخص")} / موعد: ${escapeHtml(task.dueDate || "-")}</div>
            </div>
            <p>${escapeHtml(task.description || "")}</p>
            ${logs}
            <div class="inline-actions">
              <span class="badge ${task.status === "انجام شده" ? "success" : task.priority === "بالا" ? "danger" : "warning"}">${escapeHtml(task.status)}</span>
              <span class="badge">${escapeHtml(task.priority)}</span>
              <button class="button secondary" data-action="task-log" data-id="${task.id}">ثبت لاگ</button>
              <button class="icon-button" title="تغییر وضعیت" data-action="cycle-task" data-id="${task.id}">✓</button>
              <button class="icon-button" title="ویرایش" data-action="edit-task" data-id="${task.id}">✎</button>
              <button class="icon-button danger-icon" title="حذف" data-action="delete-task" data-id="${task.id}">×</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function progressChart() {
  const total = Math.max(state.tasks.length, 1);
  const done = state.tasks.filter((task) => task.status === "انجام شده").length;
  const doing = state.tasks.filter((task) => task.status === "در حال انجام").length;
  const fresh = state.tasks.filter((task) => task.status === "جدید").length;
  const percent = Math.round((done / total) * 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;
  return `
    <div class="progress-widget">
      <svg viewBox="0 0 140 140" role="img" aria-label="نمودار پیشرفت کار">
        <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#edf2f7" stroke-width="14"></circle>
        <circle cx="70" cy="70" r="${radius}" fill="none" stroke="var(--primary)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90 70 70)"></circle>
        <text x="70" y="68" text-anchor="middle" font-size="24" font-weight="700" fill="#172033">${new Intl.NumberFormat("fa-IR").format(percent)}٪</text>
        <text x="70" y="90" text-anchor="middle" font-size="11" fill="#68748a">انجام شده</text>
      </svg>
      <div class="progress-stats">
        <span><strong>${new Intl.NumberFormat("fa-IR").format(state.tasks.length)}</strong> کل تسک‌ها</span>
        <span><strong>${new Intl.NumberFormat("fa-IR").format(done)}</strong> انجام شده</span>
        <span><strong>${new Intl.NumberFormat("fa-IR").format(doing)}</strong> در حال انجام</span>
        <span><strong>${new Intl.NumberFormat("fa-IR").format(fresh)}</strong> جدید</span>
      </div>
    </div>
  `;
}

function taskTimeline(taskId) {
  const logs = state.taskLogs.filter((log) => log.taskId === taskId);
  if (!logs.length) return "";
  return `
    <div class="timeline">
      ${logs.map((log) => `
        <div class="timeline-item">
          <span class="timeline-dot"></span>
          <div>
            <strong>${escapeHtml(log.title)}</strong>
            <p>${escapeHtml(log.body)}</p>
            <small>${escapeHtml(log.date)} / ${escapeHtml(log.user)}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function taskClass(task) {
  const priority = task.priority === "بالا" ? "priority-high" : task.priority === "متوسط" ? "priority-medium" : "priority-low";
  const done = task.status === "انجام شده" ? "is-done" : "";
  return `${priority} ${done}`;
}

function renderReports() {
  return `
    <section class="grid cols-2">
      <div class="panel">
        <div class="panel-header"><strong>ارزش فرصت‌ها در مراحل</strong></div>
        <div class="panel-body">${barChart(stageValues())}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><strong>مشتریان بر اساس وضعیت</strong></div>
        <div class="panel-body">${donutChart(customerStatusValues())}</div>
      </div>
    </section>
  `;
}

function stageValues() {
  return stages.map((stage) => ({
    label: stage.label,
    value: state.deals.filter((deal) => deal.stage === stage.key).reduce((sum, deal) => sum + Number(deal.amount || 0), 0)
  }));
}

function customerStatusValues() {
  const map = new Map();
  state.customers.forEach((customer) => map.set(customer.status || "جدید", (map.get(customer.status || "جدید") || 0) + 1));
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

function barChart(items) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const bars = items.map((item, index) => {
    const h = item.value ? Math.max(8, (item.value / max) * 170) : 0;
    const x = 30 + index * 92;
    const y = 200 - h;
    return `
      <rect x="${x}" y="${y}" width="48" height="${h}" rx="6" fill="${index === 0 ? "#116a7b" : index === 1 ? "#2b7f9b" : index === 2 ? "#d99b2b" : "#22845f"}"></rect>
      <text x="${x + 24}" y="230" text-anchor="middle" font-size="12" fill="#68748a">${item.label}</text>
      <text x="${x + 24}" y="${y - 8}" text-anchor="middle" font-size="11" fill="#172033">${new Intl.NumberFormat("fa-IR", { notation: "compact" }).format(item.value)}</text>
    `;
  }).join("");

  return `<svg class="chart" viewBox="0 0 400 260" role="img" aria-label="نمودار ستونی">${bars}<line x1="16" y1="206" x2="384" y2="206" stroke="#d9e1ec"/></svg>`;
}

function donutChart(items) {
  if (!items.length) return `<div class="empty">هنوز داده‌ای برای نمودار وجود ندارد.</div>`;
  const total = Math.max(items.reduce((sum, item) => sum + item.value, 0), 1);
  let offset = 25;
  const colors = ["#116a7b", "#d99b2b", "#22845f", "#c44747"];
  const rings = items.map((item, index) => {
    const dash = (item.value / total) * 100;
    const ring = `<circle cx="130" cy="130" r="70" fill="none" stroke="${colors[index % colors.length]}" stroke-width="28" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${offset}" pathLength="100"></circle>`;
    offset -= dash;
    return ring;
  }).join("");
  const legend = items.map((item, index) => `
    <div class="legend-row">
      <span style="background:${colors[index % colors.length]}"></span>
      <strong>${escapeHtml(item.label)}</strong>
      <em>${new Intl.NumberFormat("fa-IR").format(item.value)}</em>
    </div>
  `).join("");

  return `
    <div class="donut-layout">
      <svg class="chart" viewBox="0 0 260 260" role="img" aria-label="نمودار حلقه‌ای">
        <circle cx="130" cy="130" r="70" fill="none" stroke="#edf2f7" stroke-width="28"></circle>
        ${rings}
        <text x="130" y="126" text-anchor="middle" font-size="26" font-weight="700" fill="#172033">${new Intl.NumberFormat("fa-IR").format(total)}</text>
        <text x="130" y="150" text-anchor="middle" font-size="12" fill="#68748a">مشتری</text>
      </svg>
      <div>${legend}</div>
    </div>
  `;
}

function activityList() {
  if (!state.logs.length) return `<div class="empty">هنوز لاگی ثبت نشده است.</div>`;
  return state.logs.slice(0, 6).map((log) => {
    const customer = state.customers.find((item) => item.id === log.customerId);
    return `
      <div class="activity-row">
        <div>
          <strong>${escapeHtml(log.type)} - ${escapeHtml(customer?.name || "مشتری حذف شده")}</strong>
          <div class="eyebrow">${escapeHtml(log.date)} / ${escapeHtml(log.user)}</div>
        </div>
        <span>${escapeHtml(log.nextFollowUp || "")}</span>
      </div>
    `;
  }).join("");
}

function renderLetters() {
  if (!state.letters.length) {
    return `
      <div class="panel empty">
        <div>
          <strong>هنوز نامه‌ای ثبت نشده است.</strong>
          <p>از «نامه جدید» یک نامه داخلی یا اداری بسازید و همان‌جا نسخه چاپی بگیرید.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>شماره</th><th>موضوع</th><th>گیرنده</th><th>نوع</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th></tr></thead>
          <tbody>
            ${state.letters.map((letter) => `
              <tr>
                <td>${escapeHtml(letter.number)}</td>
                <td><strong>${escapeHtml(letter.subject)}</strong></td>
                <td>${escapeHtml(letter.recipientName || letter.recipient)}</td>
                <td>${escapeHtml(letter.type)}</td>
                <td><span class="badge ${letter.status === "بایگانی شده" ? "success" : "warning"}">${escapeHtml(letter.status)}</span></td>
                <td>${escapeHtml(letter.date)}</td>
                <td class="inline-actions">
                  <button class="icon-button" title="ویرایش" data-action="edit-letter" data-id="${letter.id}">✎</button>
                  <button class="icon-button" title="چاپ" data-action="print-letter" data-id="${letter.id}">⎙</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderChat() {
  const user = currentUser();
  const chatPeople = state.users.filter((item) => item.active);
  const selectedPerson = activeChatTarget === "public" ? null : state.users.find((item) => item.id === activeChatTarget);
  const visibleMessages = state.chats.filter((message) => {
    if (activeChatTarget === "public") return message.visibility === "public";
    return message.visibility === "private" && (
      (message.senderId === user.id && message.recipientId === activeChatTarget) ||
      (message.senderId === activeChatTarget && message.recipientId === user.id)
    );
  });
  const chatQuery = chatSearch.trim().toLowerCase();
  const searchedMessages = visibleMessages.filter((message) => {
    if (!chatQuery) return true;
    return `${message.body} ${userName(message.senderId)} ${message.attachments?.map((file) => file.name).join(" ") || ""}`.toLowerCase().includes(chatQuery);
  });
  const orderedMessages = [...searchedMessages].reverse();
  const filteredPeople = chatPeople.filter((person) => {
    if (!chatQuery) return true;
    return `${person.name} ${roleLabel(person.role)}`.toLowerCase().includes(chatQuery);
  });
  const replyTo = state.chats.find((message) => message.id === replyToChatId);
  const chatTitle = selectedPerson ? selectedPerson.name : "کانال عمومی";
  const chatSubtitle = selectedPerson ? roleLabel(selectedPerson.role) : "همه اعضای سیستم";
  const chatAvatar = selectedPerson ? userAvatar(selectedPerson, "avatar chat-current-avatar") : `<span class="avatar chat-current-avatar">ع</span>`;

  return `
    <section class="chat-shell">
      <div class="chat-main">
        <header class="chat-top">
          ${chatAvatar}
          <div>
            <strong>${escapeHtml(chatTitle)}</strong>
            <span>${escapeHtml(chatSubtitle)}</span>
          </div>
          <span class="badge success">${new Intl.NumberFormat("fa-IR").format(searchedMessages.length)} پیام</span>
        </header>
        <div class="chat-list">
          ${orderedMessages.length ? orderedMessages.map(chatMessage).join("") : `<div class="empty">پیامی برای نمایش پیدا نشد.</div>`}
        </div>
        <form class="chat-compose-bar" data-form="chat">
          ${replyTo ? `
            <div class="reply-preview">
              <div><strong>پاسخ به ${escapeHtml(userName(replyTo.senderId))}</strong><span>${escapeHtml(replyTo.body).slice(0, 90)}</span></div>
              <button class="icon-button" type="button" data-action="cancel-reply">×</button>
            </div>
          ` : ""}
          <label class="field chat-body-field"><span>متن پیام</span><textarea class="textarea" name="body" required placeholder="پیام خود را بنویسید"></textarea></label>
          <label class="chat-attach"><input name="attachments" type="file" multiple><span>Attach</span></label>
          <button class="button send-button" type="submit">➤</button>
        </form>
      </div>
      <aside class="chat-rooms">
        <div class="chat-sidebar-head">
          ${userAvatar(user)}
          <div><strong>پیام‌ها</strong><span>${escapeHtml(user.name)}</span></div>
        </div>
        <input class="input chat-search" data-action="chat-search" placeholder="جستجوی پیام‌ها" value="${escapeHtml(chatSearch)}" />
        <div class="chat-room ${activeChatTarget === "public" ? "active" : ""}" data-action="select-chat" data-target="public">
          <strong>کانال عمومی</strong>
          <span>${new Intl.NumberFormat("fa-IR").format(state.chats.filter((message) => message.visibility === "public").length)} پیام</span>
        </div>
        <div class="chat-room">
          <strong>محرمانه‌ها</strong>
          <span>${new Intl.NumberFormat("fa-IR").format(state.chats.filter((message) => message.visibility === "private" && (message.senderId === user.id || message.recipientId === user.id)).length)} پیام</span>
        </div>
        <div class="chat-room">
          <strong>خوانده‌نشده</strong>
          <span>${new Intl.NumberFormat("fa-IR").format(visibleMessages.filter((message) => !(message.readBy || []).includes(user.id) && message.senderId !== user.id).length)} پیام</span>
        </div>
        <div class="chat-people">
          ${filteredPeople.map((person) => `
          <div class="chat-person ${person.id === user.id ? "self" : ""} ${activeChatTarget === person.id ? "active" : ""}" data-action="select-chat" data-target="${person.id}">
            ${userAvatar(person)}
            <div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(roleLabel(person.role))}</span></div>
            <small>${person.id === user.id ? "شما" : ""}</small>
          </div>
          `).join("")}
        </div>
      </aside>
    </section>
  `;
}

function chatMessage(message) {
  const user = currentUser();
  const sender = state.users.find((item) => item.id === message.senderId);
  const recipient = state.users.find((item) => item.id === message.recipientId);
  const isMine = message.senderId === user.id;
  const reply = state.chats.find((item) => item.id === message.replyToId);
  const readBy = message.readBy || [];
  const isRead = readBy.includes(user.id) || isMine;
  return `
    <article class="chat-message ${message.visibility === "private" ? "private" : ""} ${isMine ? "mine" : "theirs"} ${isRead ? "read" : "unread"}">
      <div class="chat-message-head">
        <strong>${escapeHtml(sender?.name || "کاربر حذف شده")}</strong>
        <span class="badge ${message.visibility === "private" ? "warning" : "success"}">${message.visibility === "private" ? `محرمانه برای ${escapeHtml(recipient?.name || "گیرنده")}` : "عمومی"}</span>
      </div>
      ${reply ? `<div class="quoted-message"><strong>${escapeHtml(userName(reply.senderId))}</strong><span>${escapeHtml(reply.body).slice(0, 120)}</span></div>` : ""}
      <p>${escapeHtml(message.body).replaceAll("\n", "<br>")}</p>
      ${attachmentList(message.attachments)}
      <div class="chat-message-foot">
        <span>${escapeHtml(message.date)}</span>
        <span>${isMine ? `خوانده‌شده: ${new Intl.NumberFormat("fa-IR").format(readBy.length)}` : isRead ? "خوانده شده" : "خوانده نشده"}</span>
      </div>
      <div class="chat-actions">
        <button class="button secondary" data-action="reply-chat" data-id="${message.id}">ریپلای</button>
        ${!isMine && !isRead ? `<button class="button secondary" data-action="mark-read" data-id="${message.id}">خواندم</button>` : ""}
      </div>
    </article>
  `;
}

function renderUsers() {
  const showAttendance = isSystemAdmin();
  return `
    <section class="panel">
      <div class="tabs">
        <button class="${usersTab === "users" ? "active" : ""}" data-action="users-tab" data-tab="users">کاربران</button>
        <button class="${usersTab === "roles" ? "active" : ""}" data-action="users-tab" data-tab="roles">نقش‌ها و دسترسی‌ها</button>
      </div>
      ${usersTab === "users" ? `
      <div>
        <div class="panel-header"><strong>کاربران</strong><span class="eyebrow">اتصال کاربر به نقش</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>نام</th><th>ایمیل</th><th>نقش</th><th>وضعیت</th><th>دسترسی‌ها</th>${showAttendance ? "<th>آخرین ورود</th><th>آخرین خروج</th>" : ""}<th>عملیات</th></tr></thead>
            <tbody>
              ${state.users.map((user) => `
                <tr>
                  <td><div class="user-cell">${userAvatar(user, "table-avatar")}<strong>${escapeHtml(user.name)}</strong></div></td>
                  <td>${escapeHtml(user.email)}</td>
                  <td>${roleLabel(user.role)}</td>
                  <td><span class="badge ${user.active ? "success" : "danger"}">${user.active ? "فعال" : "غیرفعال"}</span></td>
                  <td>${roleByKey(user.role)?.permissions.length || 0} مورد</td>
                  ${showAttendance ? `<td>${escapeHtml(user.lastLoginAt || "-")}</td><td>${escapeHtml(user.lastLogoutAt || "-")}</td>` : ""}
                  <td><button class="icon-button" title="ویرایش" data-action="edit-user" data-id="${user.id}">✎</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>` : `
      <div>
        <div class="panel-header"><strong>نقش‌ها</strong><span class="eyebrow">نام و سطح دسترسی قابل ویرایش</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>نام نقش</th><th>کلید</th><th>دسترسی‌ها</th><th>عملیات</th></tr></thead>
            <tbody>
              ${Object.entries(state.roles).map(([key, role]) => `
                <tr>
                  <td><strong>${escapeHtml(role.label)}</strong></td>
                  <td>${escapeHtml(key)}</td>
                  <td>${role.permissions.length} مورد</td>
                  <td><button class="icon-button" title="ویرایش نقش" data-action="edit-role" data-id="${key}">✎</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>`}
    </section>
  `;
}

function renderSettings() {
  return `
    <form class="panel" data-form="settings" id="settings-form">
      <div class="panel-header"><strong>مشخصات شرکت و ظاهر سیستم</strong><button class="button" type="submit">ذخیره</button></div>
      <div class="panel-body form-grid">
        ${input("companyName", "نام شرکت", state.settings.companyName)}
        ${input("brandShort", "نام کوتاه / لوگوی متنی", state.settings.brandShort)}
        ${input("slogan", "زیرعنوان سیستم", state.settings.slogan)}
        ${input("managerName", "نام مدیر / امضاکننده", state.settings.managerName)}
        ${input("registrationNo", "شماره ثبت", state.settings.registrationNo)}
        ${input("nationalId", "شناسه ملی", state.settings.nationalId)}
        ${input("phone", "تلفن شرکت", state.settings.phone)}
        ${input("email", "ایمیل شرکت", state.settings.email)}
        ${input("primaryColor", "رنگ اصلی", state.settings.primaryColor, "color")}
        ${select("defaultFont", "فونت سیستم", [
          { value: "Vazirmatn, Vazir, Tahoma, Arial, sans-serif", label: "وزیری / وزیرمتن" },
          { value: "Tahoma, Arial, sans-serif", label: "Tahoma" },
          { value: "Arial, sans-serif", label: "Arial" }
        ], state.settings.defaultFont)}
        <label class="field" style="grid-column:1/-1"><span>آدرس</span><textarea class="textarea" name="address">${escapeHtml(state.settings.address)}</textarea></label>
        <label class="field" style="grid-column:1/-1"><span>سربرگ پیش‌فرض نامه</span><textarea class="textarea" name="letterHeader">${escapeHtml(state.settings.letterHeader)}</textarea></label>
        <label class="field" style="grid-column:1/-1"><span>پانوشت پیش‌فرض نامه</span><textarea class="textarea" name="letterFooter">${escapeHtml(state.settings.letterFooter)}</textarea></label>
      </div>
    </form>
  `;
}

function renderModal() {
  if (!modal) return "";
  if (modal.type === "customer") return customerModal(modal.id);
  if (modal.type === "logs") return logsModal(modal.id);
  if (modal.type === "deal") return dealModal(modal.id);
  if (modal.type === "user") return userModal(modal.id);
  if (modal.type === "profile") return profileModal();
  if (modal.type === "role") return roleModal(modal.id);
  if (modal.type === "task") return taskModal(modal.id);
  if (modal.type === "task-log") return taskLogModal(modal.id);
  if (modal.type === "dashboard") return dashboardModal();
  if (modal.type === "letter") return letterModal(modal.id);
  if (modal.type === "print") return printModal(modal.id);
  return "";
}

function customerModal(id) {
  const customer = state.customers.find((item) => item.id === id) || {};
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="customer" data-id="${id || ""}">
        ${modalHead(id ? "ویرایش مشتری" : "ثبت مشتری جدید")}
        <div class="modal-body form-grid">
          ${input("name", "نام شرکت / مشتری", customer.name)}
          ${input("contact", "نام رابط", customer.contact)}
          ${input("phone", "تلفن", customer.phone)}
          ${input("email", "ایمیل", customer.email)}
          ${input("segment", "بخش / دسته‌بندی", customer.segment)}
          ${select("status", "وضعیت", ["جدید", "در مذاکره", "فعال", "غیرفعال"], customer.status || "جدید")}
          ${input("owner", "مالک", customer.owner || currentUser().name)}
          ${input("value", "ارزش تقریبی", customer.value || 0, "number")}
          ${input("lastContact", "آخرین تماس", customer.lastContact || todayFa())}
          <label class="field" style="grid-column:1/-1"><span>یادداشت پایه</span><textarea class="textarea" name="notes">${escapeHtml(customer.notes || "")}</textarea></label>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function logsModal(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  const logs = state.logs.filter((log) => log.customerId === customerId);
  return `
    <div class="modal-backdrop">
      <div class="modal wide-modal">
        ${modalHead(`لاگ‌های ${customer ? customer.name : "مشتری"}`)}
        <div class="modal-body">
          <form class="log-form" data-form="log" data-customer-id="${customerId}">
            ${select("type", "نوع فعالیت", ["تماس", "جلسه", "یادداشت", "پیگیری", "ارسال پیش‌فاکتور"], "تماس")}
            ${input("date", "تاریخ", todayFa())}
            ${input("nextFollowUp", "پیگیری بعدی")}
            <label class="field"><span>متن لاگ</span><textarea class="textarea" name="body" required></textarea></label>
            <button class="button" type="submit">ثبت لاگ</button>
          </form>
          <div class="log-list">
            ${logs.length ? logs.map(logItem).join("") : `<div class="empty">برای این مشتری هنوز لاگی ثبت نشده است.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function logItem(log) {
  return `
    <article class="log-item">
      <div>
        <strong>${escapeHtml(log.type)}</strong>
        <span class="eyebrow">${escapeHtml(log.date)} / ${escapeHtml(log.user)}</span>
      </div>
      <p>${escapeHtml(log.body)}</p>
      ${log.nextFollowUp ? `<span class="badge warning">پیگیری: ${escapeHtml(log.nextFollowUp)}</span>` : ""}
    </article>
  `;
}

function dealModal(id) {
  const deal = state.deals.find((item) => item.id === id) || {};
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="deal" data-id="${id || ""}">
        ${modalHead(id ? "ویرایش فرصت" : "فرصت جدید")}
        <div class="modal-body form-grid">
          ${input("title", "عنوان فرصت", deal.title)}
          ${select("customerId", "مشتری", state.customers.map((c) => ({ label: c.name, value: c.id })), deal.customerId)}
          ${input("owner", "مسئول", deal.owner || currentUser().name)}
          ${select("stage", "مرحله", stages.map((s) => ({ label: s.label, value: s.key })), deal.stage || "lead")}
          ${input("amount", "مبلغ", deal.amount || 0, "number")}
          ${input("dueDate", "موعد", deal.dueDate || todayFa())}
          ${select("priority", "اولویت", ["پایین", "متوسط", "بالا"], deal.priority || "متوسط")}
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function userModal(id) {
  const user = state.users.find((item) => item.id === id) || {};
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="user" data-id="${id || ""}">
        ${modalHead(id ? "ویرایش کاربر" : "کاربر جدید")}
        <div class="modal-body">
          <div class="form-grid">
            ${input("name", "نام", user.name)}
            ${input("email", "ایمیل", user.email)}
            ${input("password", "رمز عبور", user.password || "123456", "password")}
            ${input("phone", "تلفن", user.phone)}
            ${input("title", "عنوان شغلی", user.title)}
            ${select("role", "نقش", Object.entries(state.roles).map(([value, role]) => ({ value, label: role.label })), user.role || "sales")}
            ${select("active", "وضعیت", [{ value: "true", label: "فعال" }, { value: "false", label: "غیرفعال" }], String(user.active ?? true))}
          </div>
          <label class="field"><span>درباره کاربر</span><textarea class="textarea" name="bio">${escapeHtml(user.bio || "")}</textarea></label>
          <h3 style="margin-top:12px">دسترسی‌های نقش</h3>
          <div class="permissions">
            ${PERMISSIONS.map((permission) => `
              <label class="check-row">
                <input type="checkbox" disabled ${roleByKey(user.role || "sales")?.permissions.includes(permission.key) ? "checked" : ""} />
                <span>${permission.label}</span>
              </label>
            `).join("")}
          </div>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function profileModal() {
  const user = currentUser();
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="profile">
          ${modalHead("ویرایش پروفایل من")}
        <div class="modal-body">
          <div class="profile-summary">
            ${userAvatar(user, "profile-avatar")}
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(roleLabel(user.role))}</span>
            </div>
          </div>
          <div class="form-grid">
            ${input("name", "نام", user.name)}
            ${input("email", "ایمیل", user.email)}
            ${input("password", "رمز عبور", user.password || "", "password")}
            ${input("phone", "تلفن", user.phone || "")}
            ${input("title", "عنوان شغلی", user.title || "")}
            <label class="field"><span>عکس پروفایل</span><input class="input" name="avatarFile" type="file" accept="image/*" /></label>
          </div>
          <label class="field"><span>درباره من</span><textarea class="textarea" name="bio">${escapeHtml(user.bio || "")}</textarea></label>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function roleModal(key) {
  const role = key ? state.roles[key] : { label: "", permissions: ["dashboard"] };
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="role" data-id="${key || ""}">
        ${modalHead(key ? "ویرایش نقش" : "نقش جدید")}
        <div class="modal-body">
          <div class="form-grid">
            ${input("label", "نام نقش", role.label)}
            ${input("key", "کلید نقش انگلیسی", key || "", "text")}
          </div>
          <h3>دسترسی‌ها</h3>
          <div class="permissions">
            ${PERMISSIONS.map((permission) => `
              <label class="check-row">
                <input type="checkbox" name="permissions" value="${permission.key}" ${role.permissions.includes(permission.key) ? "checked" : ""} />
                <span>${permission.label}</span>
              </label>
            `).join("")}
          </div>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function taskModal(id) {
  const task = state.tasks.find((item) => item.id === id) || {};
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="task" data-id="${id || ""}">
        ${modalHead(id ? "ویرایش تسک" : "تسک جدید")}
        <div class="modal-body form-grid">
          ${input("title", "عنوان تسک", task.title)}
          ${select("assigneeId", "مسئول انجام", userOptions(), task.assigneeId)}
          ${input("dueDate", "موعد", task.dueDate || todayFa())}
          ${select("priority", "اولویت", ["پایین", "متوسط", "بالا"], task.priority || "متوسط")}
          ${select("status", "وضعیت", ["جدید", "در حال انجام", "انجام شده"], task.status || "جدید")}
          <label class="field" style="grid-column:1/-1"><span>توضیحات</span><textarea class="textarea" name="description">${escapeHtml(task.description || "")}</textarea></label>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function taskLogModal(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="task-log" data-task-id="${taskId}">
        ${modalHead(`ثبت لاگ برای ${task?.title || "تسک"}`)}
        <div class="modal-body">
          ${input("title", "عنوان لاگ", "گزارش پیشرفت")}
          <label class="field"><span>متن لاگ</span><textarea class="textarea" name="body" required></textarea></label>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function dashboardModal() {
  const widgets = state.settings.dashboardWidgets || [];
  const options = [
    { key: "metrics", label: "کارت‌های آماری" },
    { key: "calendar", label: "تقویم شمسی و میلادی" },
    { key: "tasks", label: "تسک‌های اخیر" },
    { key: "pipeline", label: "نمودار قیف فروش" },
    { key: "logs", label: "آخرین لاگ‌های CRM" },
    { key: "letters", label: "نامه‌های فعال" },
    { key: "note", label: "بخش سفارشی متنی" }
  ];
  return `
    <div class="modal-backdrop">
      <form class="modal" data-form="dashboard">
        ${modalHead("ویرایش داشبورد")}
        <div class="modal-body">
          <div class="permissions">
            ${options.map((item) => `
              <label class="check-row">
                <input type="checkbox" name="widgets" value="${item.key}" ${widgets.includes(item.key) ? "checked" : ""} />
                <span>${item.label}</span>
              </label>
            `).join("")}
          </div>
          <label class="field" style="margin-top:14px"><span>متن بخش سفارشی داشبورد</span><textarea class="textarea" name="dashboardNote">${escapeHtml(state.settings.dashboardNote || "")}</textarea></label>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function letterModal(id) {
  const letter = state.letters.find((item) => item.id === id) || {};
  return `
    <div class="modal-backdrop">
      <form class="modal wide-modal" data-form="letter" data-id="${id || ""}">
        ${modalHead(id ? "ویرایش نامه" : "نامه جدید")}
        <div class="modal-body form-grid">
          ${input("number", "شماره نامه", letter.number || nextLetterNumber())}
          ${input("date", "تاریخ", letter.date || todayFa())}
          ${select("type", "نوع نامه", ["نامه داخلی", "نامه اداری", "درخواست داخلی", "صورتجلسه"], letter.type || "نامه داخلی")}
          ${select("status", "وضعیت", ["پیش‌نویس", "در گردش", "تایید شده", "بایگانی شده"], letter.status || "پیش‌نویس")}
          ${input("sender", "فرستنده", letter.sender || currentUser().name)}
          ${select("recipientUserId", "گیرنده از اعضای سیستم", userOptions(), letter.recipientUserId)}
          ${input("subject", "موضوع", letter.subject)}
          ${input("signer", "امضاکننده", letter.signer || state.settings.managerName)}
          ${fileInput("attachments", "پیوست نامه")}
          ${letter.attachments?.length ? `<div class="field"><span>پیوست‌های فعلی</span>${attachmentList(letter.attachments)}</div>` : ""}
          <label class="field" style="grid-column:1/-1"><span>متن نامه</span><textarea class="textarea letter-editor" name="body">${escapeHtml(letter.body || "")}</textarea></label>
        </div>
        ${modalFoot()}
      </form>
    </div>
  `;
}

function printModal(id) {
  const letter = state.letters.find((item) => item.id === id);
  if (!letter) return "";
  return `
    <div class="modal-backdrop">
      <div class="modal print-shell">
        <div class="modal-head no-print">
          <strong>پیش‌نمایش چاپ</strong>
          <div class="inline-actions">
            <button class="button" data-action="browser-print">چاپ</button>
            <button class="icon-button" data-action="close-modal">×</button>
          </div>
        </div>
        <div class="letter-page" id="print-area">
          ${letterPrintHtml(letter)}
        </div>
      </div>
    </div>
  `;
}

function letterPrintHtml(letter) {
  return `
    <header class="letter-head">
      <div>
        <strong>${escapeHtml(state.settings.companyName)}</strong>
        <span>${escapeHtml(state.settings.letterHeader)}</span>
      </div>
      <div class="letter-meta">
        <span>شماره: ${escapeHtml(letter.number)}</span>
        <span>تاریخ: ${escapeHtml(letter.date)}</span>
      </div>
    </header>
    <section class="letter-title">
      <span>از: ${escapeHtml(letter.sender)}</span>
      <span>به: ${escapeHtml(letter.recipientName || letter.recipient)}</span>
      <strong>موضوع: ${escapeHtml(letter.subject)}</strong>
    </section>
    <article class="letter-body">${escapeHtml(letter.body).replaceAll("\n", "<br>")}</article>
    ${letter.attachments?.length ? `<section class="letter-attachments"><strong>پیوست‌ها:</strong>${attachmentList(letter.attachments)}</section>` : ""}
    <footer class="letter-footer">
      <div>${escapeHtml(letter.signer || state.settings.managerName)}</div>
      <div>${escapeHtml(state.settings.letterFooter)}</div>
      <small>${escapeHtml(state.settings.address)} ${state.settings.phone ? ` / تلفن: ${escapeHtml(state.settings.phone)}` : ""}</small>
    </footer>
  `;
}

function modalHead(title) {
  return `<div class="modal-head"><strong>${escapeHtml(title)}</strong><button class="icon-button" type="button" data-action="close-modal">×</button></div>`;
}

function modalFoot() {
  return `<div class="modal-foot"><button class="button" type="submit">ذخیره</button><button class="button secondary" type="button" data-action="close-modal">انصراف</button></div>`;
}

function input(name, label, value = "", type = "text") {
  return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="${type}" value="${escapeHtml(value)}" /></label>`;
}

function select(name, label, options, value = "") {
  const normalized = options.map((option) => typeof option === "string" ? { label: option, value: option } : option);
  return `
    <label class="field">
      <span>${label}</span>
      <select class="select" name="${name}">
        ${normalized.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    </label>
  `;
}

function fileInput(name, label) {
  return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="file" multiple /></label>`;
}

function userOptions(includeCurrent = true) {
  return state.users
    .filter((user) => user.active && (includeCurrent || user.id !== currentUser().id))
    .map((user) => ({ value: user.id, label: `${user.name} - ${roleLabel(user.role)}` }));
}

function userName(userId) {
  return state.users.find((user) => user.id === userId)?.name || "";
}

function attachmentList(attachments = []) {
  if (!attachments.length) return "";
  return `
    <div class="attachment-list">
      ${attachments.map((file) => `
        <a class="attachment-chip" href="${file.dataUrl}" download="${escapeHtml(file.name)}">
          <span>📎</span>
          <strong>${escapeHtml(file.name)}</strong>
          <small>${formatBytes(file.size)}</small>
        </a>
      `).join("")}
    </div>
  `;
}

function formatBytes(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readAttachments(files) {
  return Promise.all([...files].map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: uid("file"),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

async function readSingleFile(files) {
  const [file] = await readAttachments(files);
  return file || null;
}

function nextLetterNumber() {
  return `L-${new Intl.NumberFormat("en-US", { minimumIntegerDigits: 4, useGrouping: false }).format(state.letters.length + 1)}`;
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route], [data-action]");
  if (!button) return;

  if (button.dataset.route) {
    route = button.dataset.route;
    render();
    return;
  }

  const action = button.dataset.action;
  if (action === "logout") {
    recordLogout();
    clearSession();
    sessionUserId = null;
    render();
  }
  if (action === "users-tab") {
    usersTab = button.dataset.tab;
    render();
  }
  if (action === "tasks-tab") {
    tasksTab = button.dataset.tab;
    render();
  }
  if (action === "reply-chat") {
    replyToChatId = button.dataset.id;
    render();
  }
  if (action === "cancel-reply") {
    replyToChatId = null;
    render();
  }
  if (action === "mark-read") markChatRead(button.dataset.id);
  if (action === "select-chat") {
    activeChatTarget = button.dataset.target;
    replyToChatId = null;
    chatSearch = "";
    render();
  }
  if (action === "new-customer") setModal({ type: "customer" });
  if (action === "edit-customer") setModal({ type: "customer", id: button.dataset.id });
  if (action === "open-logs") setModal({ type: "logs", id: button.dataset.id });
  if (action === "new-deal") setModal({ type: "deal" });
  if (action === "edit-deal") setModal({ type: "deal", id: button.dataset.id });
  if (action === "new-task") setModal({ type: "task" });
  if (action === "edit-task") setModal({ type: "task", id: button.dataset.id });
  if (action === "task-log") setModal({ type: "task-log", id: button.dataset.id });
  if (action === "cycle-task") cycleTask(button.dataset.id);
  if (action === "delete-task") deleteTask(button.dataset.id);
  if (action === "delete-deal") deleteDeal(button.dataset.id);
  if (action === "enable-notifications") enableNotifications();
  if (action === "dashboard-settings") setModal({ type: "dashboard" });
  if (action === "edit-profile") setModal({ type: "profile" });
  if (action === "new-user") setModal({ type: "user" });
  if (action === "edit-user") setModal({ type: "user", id: button.dataset.id });
  if (action === "new-role") setModal({ type: "role" });
  if (action === "edit-role") setModal({ type: "role", id: button.dataset.id });
  if (action === "new-letter") setModal({ type: "letter" });
  if (action === "edit-letter") setModal({ type: "letter", id: button.dataset.id });
  if (action === "print-letter") setModal({ type: "print", id: button.dataset.id });
  if (action === "browser-print") window.print();
  if (action === "close-modal") setModal(null);
  if (action === "move-deal") moveDeal(button.dataset.id, Number(button.dataset.dir));
  if (action === "save-settings-external") document.querySelector("#settings-form")?.requestSubmit();
});

app.addEventListener("input", (event) => {
  if (event.target.dataset.action === "search") {
    search = event.target.value;
    render();
  }
  if (event.target.dataset.action === "chat-search") {
    const cursorPosition = event.target.selectionStart;
    chatSearch = event.target.value;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector(".chat-search");
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }
});

app.addEventListener("keydown", (event) => {
  const textarea = event.target.closest("textarea[name='body']");
  const form = textarea?.closest("form[data-form='chat']");
  if (!form || event.key !== "Enter" || event.shiftKey) return;

  event.preventDefault();
  form.requestSubmit();
});

app.addEventListener("dblclick", (event) => {
  const taskCard = event.target.closest("[data-task-id]");
  if (taskCard) setModal({ type: "task", id: taskCard.dataset.taskId });
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());

  if (form.dataset.form === "login") login(data);
  if (form.dataset.form === "customer") saveCustomer(form.dataset.id, data);
  if (form.dataset.form === "log") saveLog(form.dataset.customerId, data);
  if (form.dataset.form === "deal") saveDeal(form.dataset.id, data);
  if (form.dataset.form === "task") saveTask(form.dataset.id, data);
  if (form.dataset.form === "task-log") saveTaskLog(form.dataset.taskId, data);
  if (form.dataset.form === "user") saveUser(form.dataset.id, data);
  if (form.dataset.form === "profile") await saveProfile(data, form);
  if (form.dataset.form === "role") saveRole(form.dataset.id, form, data);
  if (form.dataset.form === "letter") await saveLetter(form.dataset.id, data, form);
  if (form.dataset.form === "chat") await saveChat(data, form);
  if (form.dataset.form === "dashboard") saveDashboard(form);
  if (form.dataset.form === "settings") saveSettings(data);
});

app.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-deal-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.dealId);
  event.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
});

app.addEventListener("dragend", (event) => {
  event.target.closest("[data-deal-id]")?.classList.remove("dragging");
  document.querySelectorAll(".column.drag-over").forEach((column) => column.classList.remove("drag-over"));
});

app.addEventListener("dragover", (event) => {
  const column = event.target.closest("[data-stage]");
  if (!column) return;
  event.preventDefault();
  column.classList.add("drag-over");
});

app.addEventListener("dragleave", (event) => {
  const column = event.target.closest("[data-stage]");
  if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over");
});

app.addEventListener("drop", (event) => {
  const column = event.target.closest("[data-stage]");
  if (!column) return;
  event.preventDefault();
  column.classList.remove("drag-over");
  const dealId = event.dataTransfer.getData("text/plain");
  moveDealToStage(dealId, column.dataset.stage);
});

function login(data) {
  const user = state.users.find((item) => item.email === data.email && item.password === data.password && item.active);
  if (!user) {
    alert("ایمیل یا رمز عبور درست نیست، یا کاربر غیرفعال است.");
    return;
  }
  sessionUserId = user.id;
  saveSession(user.id);
  state.users = state.users.map((item) => item.id === user.id ? { ...item, lastLoginAt: nowDateTimeFa() } : item);
  logActivity("وارد سیستم شد");
  route = "dashboard";
  persist();
}

function recordLogout() {
  const user = currentUser();
  if (!user) return;
  state.users = state.users.map((item) => item.id === user.id ? { ...item, lastLogoutAt: nowDateTimeFa() } : item);
  logActivity("از سیستم خارج شد");
  saveState(state);
}

function saveCustomer(id, data) {
  const customer = {
    id: id || uid("c"),
    name: data.name,
    contact: data.contact,
    phone: data.phone,
    email: data.email,
    segment: data.segment,
    status: data.status,
    owner: data.owner,
    value: Number(data.value || 0),
    lastContact: data.lastContact,
    notes: data.notes
  };

  state.customers = id ? state.customers.map((item) => item.id === id ? customer : item) : [customer, ...state.customers];
  logActivity(`${id ? "مشتری را ویرایش کرد" : "مشتری جدید ثبت کرد"}: ${customer.name}`);
  modal = null;
  persist();
}

function saveLog(customerId, data) {
  state.logs = [{
    id: uid("log"),
    customerId,
    type: data.type,
    date: data.date,
    nextFollowUp: data.nextFollowUp,
    body: data.body,
    user: currentUser().name
  }, ...state.logs];
  logActivity("برای مشتری لاگ CRM ثبت کرد");
  modal = { type: "logs", id: customerId };
  persist();
}

function saveDeal(id, data) {
  const deal = {
    id: id || uid("d"),
    title: data.title,
    customerId: data.customerId,
    owner: data.owner,
    stage: data.stage,
    amount: Number(data.amount || 0),
    dueDate: data.dueDate,
    priority: data.priority
  };
  state.deals = id ? state.deals.map((item) => item.id === id ? deal : item) : [deal, ...state.deals];
  logActivity(`${id ? "فرصت کانبان را ویرایش کرد" : "فرصت کانبان ساخت"}: ${deal.title}`);
  modal = null;
  persist();
}

function saveTask(id, data) {
  const task = {
    id: id || uid("task"),
    title: data.title,
    assigneeId: data.assigneeId,
    dueDate: data.dueDate,
    priority: data.priority,
    status: data.status,
    description: data.description,
    createdBy: currentUser().id
  };
  state.tasks = id ? state.tasks.map((item) => item.id === id ? task : item) : [task, ...state.tasks];
  logActivity(`${id ? "تسک را ویرایش کرد" : "تسک جدید تعریف کرد"}: ${task.title}`);
  if (!id && task.assigneeId === currentUser().id) showAppNotification("تسک جدید", task.title);
  modal = null;
  persist();
}

function saveTaskLog(taskId, data) {
  state.taskLogs = [{
    id: uid("tasklog"),
    taskId,
    title: data.title,
    body: data.body,
    date: todayFa(),
    user: currentUser().name
  }, ...state.taskLogs];
  logActivity("برای تسک لاگ پیشرفت ثبت کرد");
  modal = null;
  persist();
}

function saveUser(id, data) {
  const previous = state.users.find((item) => item.id === id);
  const user = {
    ...(previous || {}),
    id: id || uid("u"),
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    title: data.title,
    bio: data.bio,
    role: data.role,
    active: data.active === "true"
  };
  state.users = id ? state.users.map((item) => item.id === id ? user : item) : [user, ...state.users];
  logActivity(`${id ? "کاربر را ویرایش کرد" : "کاربر جدید ساخت"}: ${user.name}`);
  modal = null;
  persist();
}

async function saveProfile(data, form) {
  const avatarFile = await readSingleFile(form.elements.avatarFile?.files || []);
  state.users = state.users.map((user) => user.id === currentUser().id ? {
    ...user,
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    title: data.title,
    bio: data.bio,
    avatar: avatarFile?.dataUrl || user.avatar || ""
  } : user);
  logActivity("پروفایل خود را ویرایش کرد");
  modal = null;
  persist();
}

function saveRole(id, form, data) {
  const key = (data.key || id || "").trim().replace(/\s+/g, "_");
  if (!key) {
    alert("کلید نقش را وارد کنید.");
    return;
  }
  const permissions = new FormData(form).getAll("permissions");
  state.roles = { ...state.roles };
  if (id && id !== key) {
    delete state.roles[id];
    state.users = state.users.map((user) => user.role === id ? { ...user, role: key } : user);
  }
  state.roles[key] = {
    label: data.label || key,
    permissions: permissions.length ? permissions : ["dashboard"]
  };
  logActivity(`${id ? "نقش را ویرایش کرد" : "نقش جدید ساخت"}: ${data.label || key}`);
  modal = null;
  persist();
}

async function saveLetter(id, data, form) {
  const previous = state.letters.find((item) => item.id === id);
  const newAttachments = await readAttachments(form.elements.attachments?.files || []);
  const recipientName = userName(data.recipientUserId);
  const letter = {
    id: id || uid("letter"),
    number: data.number,
    date: data.date,
    type: data.type,
    status: data.status,
    sender: data.sender,
    recipientUserId: data.recipientUserId,
    recipientName,
    recipient: recipientName,
    subject: data.subject,
    signer: data.signer,
    body: data.body,
    attachments: [...(previous?.attachments || []), ...newAttachments]
  };
  state.letters = id ? state.letters.map((item) => item.id === id ? letter : item) : [letter, ...state.letters];
  logActivity(`${id ? "نامه را ویرایش کرد" : "نامه جدید ثبت کرد"}: ${letter.subject}`);
  modal = null;
  persist();
}

async function saveChat(data, form) {
  if (activeChatTarget !== "public" && activeChatTarget === currentUser().id) {
    alert("برای ارسال پیام خصوصی، یکی از همکاران را انتخاب کنید.");
    return;
  }

  const attachments = await readAttachments(form.elements.attachments?.files || []);
  const isPublic = activeChatTarget === "public";
  state.chats = [{
    id: uid("chat"),
    senderId: currentUser().id,
    recipientId: isPublic ? "" : activeChatTarget,
    visibility: isPublic ? "public" : "private",
    replyToId: replyToChatId,
    body: data.body,
    attachments,
    readBy: [currentUser().id],
    date: todayFa()
  }, ...state.chats];
  replyToChatId = null;
  logActivity("پیام داخلی ارسال کرد");
  showAppNotification(isPublic ? "پیام عمومی ارسال شد" : "پیام محرمانه ارسال شد", data.body || "یک پیام داخلی ثبت شد.");
  persist();
}

function markChatRead(id) {
  const userId = currentUser().id;
  state.chats = state.chats.map((message) => {
    if (message.id !== id) return message;
    const readBy = new Set(message.readBy || []);
    readBy.add(userId);
    return { ...message, readBy: [...readBy] };
  });
  persist();
}

function saveSettings(data) {
  state.settings = { ...state.settings, ...data };
  logActivity("تنظیمات شرکت را ویرایش کرد");
  persist();
}

function saveDashboard(form) {
  const widgets = new FormData(form).getAll("widgets");
  const data = Object.fromEntries(new FormData(form).entries());
  state.settings = {
    ...state.settings,
    dashboardWidgets: widgets.length ? widgets : ["metrics"],
    dashboardNote: data.dashboardNote || ""
  };
  logActivity("چیدمان داشبورد را ویرایش کرد");
  modal = null;
  persist();
}

function moveDeal(id, direction) {
  const movedDeal = state.deals.find((deal) => deal.id === id);
  state.deals = state.deals.map((deal) => {
    if (deal.id !== id) return deal;
    const index = stages.findIndex((stage) => stage.key === deal.stage);
    const next = stages[Math.max(0, Math.min(stages.length - 1, index + direction))];
    return { ...deal, stage: next.key };
  });
  if (movedDeal) logActivity(`فرصت کانبان را با دکمه جابه‌جا کرد: ${movedDeal.title}`);
  persist();
}

function moveDealToStage(id, stage) {
  const deal = state.deals.find((item) => item.id === id);
  state.deals = state.deals.map((item) => item.id === id ? { ...item, stage } : item);
  if (deal) logActivity(`فرصت کانبان را جابه‌جا کرد: ${deal.title}`);
  persist();
}

function cycleTask(id) {
  const statuses = ["جدید", "در حال انجام", "انجام شده"];
  state.tasks = state.tasks.map((task) => {
    if (task.id !== id) return task;
    const index = statuses.indexOf(task.status);
    return { ...task, status: statuses[(index + 1) % statuses.length] };
  });
  logActivity("وضعیت تسک را تغییر داد");
  persist();
}

function deleteTask(id) {
  if (!confirm("این تسک و لاگ‌های مربوط به آن حذف شود؟")) return;
  const task = state.tasks.find((item) => item.id === id);
  state.tasks = state.tasks.filter((task) => task.id !== id);
  state.taskLogs = state.taskLogs.filter((log) => log.taskId !== id);
  logActivity(`تسک را حذف کرد${task ? `: ${task.title}` : ""}`);
  persist();
}

function deleteDeal(id) {
  if (!confirm("این کارت کانبان حذف شود؟")) return;
  const deal = state.deals.find((item) => item.id === id);
  state.deals = state.deals.filter((item) => item.id !== id);
  logActivity(`کارت کانبان را حذف کرد${deal ? `: ${deal.title}` : ""}`);
  persist();
}

render();
