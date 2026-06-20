export const PERMISSIONS = [
  { key: "dashboard", label: "مشاهده داشبورد" },
  { key: "customers", label: "مدیریت مشتریان و لاگ‌ها" },
  { key: "kanban", label: "مدیریت کانبان" },
  { key: "reports", label: "مشاهده گزارش‌ها" },
  { key: "letters", label: "نامه‌نگاری و چاپ" },
  { key: "chat", label: "چت داخلی و انتقال فایل" },
  { key: "tasks", label: "مدیریت تسک‌ها" },
  { key: "users", label: "مدیریت کاربران" },
  { key: "settings", label: "تنظیمات شرکت" }
];

export const ROLES = {
  admin: {
    label: "مدیر سیستم",
    permissions: PERMISSIONS.map((item) => item.key)
  },
  sales: {
    label: "کارشناس فروش",
    permissions: ["dashboard", "customers", "kanban", "reports", "letters", "chat", "tasks"]
  },
  office: {
    label: "اداری",
    permissions: ["dashboard", "customers", "letters", "chat", "tasks"]
  }
};

export const initialState = {
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
    letterFooter: "این نامه به صورت سیستمی تولید شده است."
  },
  roles: ROLES,
  users: [
    {
      id: "u1",
      name: "مدیر سیستم",
      email: "admin@demo.local",
      password: "admin123",
      role: "admin",
      active: true,
      phone: "",
      title: "مدیر سیستم",
      bio: ""
    }
  ],
  customers: [],
  deals: [],
  letters: [],
  chats: [],
  tasks: [],
  taskLogs: [],
  activityLogs: [],
  logs: []
};
