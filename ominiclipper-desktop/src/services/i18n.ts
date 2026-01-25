/**
 * Internationalization (i18n) Service
 * Multi-language support for OmniClipper Desktop
 */

// Supported languages
export type SupportedLocale = 'en' | 'zh_CN';

// Default locale
const DEFAULT_LOCALE: SupportedLocale = 'en';

// Locale storage key
const LOCALE_KEY = 'omniclipper_locale';

// Current locale
let currentLocale: SupportedLocale = DEFAULT_LOCALE;

// Translation cache
const translations: Record<string, Record<string, string>> = {};

// English translations
const en: Record<string, string> = {
  // App
  'app.title': 'OmniCollector',
  'app.subtitle': 'Resource Management',

  // Actions
  'action.add': 'Add',
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.edit': 'Edit',
  'action.close': 'Close',
  'action.search': 'Search',
  'action.clear': 'Clear',
  'action.sync': 'Sync',
  'action.export': 'Export',
  'action.import': 'Import',
  'action.upload': 'Upload',
  'action.dragDrop': 'Drag & Drop files here',

  // Resource Types
  'type.all': 'All',
  'type.web': 'Web',
  'type.word': 'Word',
  'type.pdf': 'PDF',
  'type.epub': 'EPUB',
  'type.image': 'Image',
  'type.other': 'Other',

  // Views
  'view.listDetail': 'List',
  'view.table': 'Table',
  'view.grid': 'Grid',

  // Sidebar
  'sidebar.library': 'Library',
  'sidebar.recent': 'Recent',
  'sidebar.uncategorized': 'Uncategorized',
  'sidebar.untagged': 'Untagged',
  'sidebar.trash': 'Trash',
  'sidebar.folders': 'Folders',
  'sidebar.tags': 'Tags',
  'sidebar.colors': 'Colors',

  // Filters
  'filter.search': 'Search...',
  'filter.color': 'Filter by color',
  'filter.tag': 'Filter by tag',
  'filter.folder': 'Filter by folder',

  // Sort
  'sort.dateDesc': 'Date (Newest)',
  'sort.dateAsc': 'Date (Oldest)',
  'sort.nameAsc': 'Name (A-Z)',
  'sort.nameDesc': 'Name (Z-A)',

  // Dialogs
  'dialog.createResource': 'Create Resource',
  'dialog.editResource': 'Edit Resource',
  'dialog.createFolder': 'Create Folder',
  'dialog.editFolder': 'Edit Folder',
  'dialog.createTag': 'Create Tag',
  'dialog.editTag': 'Edit Tag',
  'dialog.importData': 'Import Data',
  'dialog.exportData': 'Export Data',
  'dialog.settings': 'Settings',
  'dialog.auth': 'Authentication',

  // Form Fields
  'form.title': 'Title',
  'form.type': 'Type',
  'form.url': 'URL',
  'form.path': 'File Path',
  'form.description': 'Description',
  'form.folder': 'Folder',
  'form.tags': 'Tags',
  'form.color': 'Color',
  'form.icon': 'Icon',
  'form.email': 'Email',
  'form.password': 'Password',

  // Settings
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.connection': 'Connection',
  'settings.supabaseUrl': 'Supabase URL',
  'settings.supabaseKey': 'Anon Key',

  // Auth
  'auth.signIn': 'Sign In',
  'auth.signUp': 'Sign Up',
  'auth.signOut': 'Sign Out',
  'auth.forgotPassword': 'Forgot Password?',

  // Messages
  'msg.noItems': 'No items yet',
  'msg.noResults': 'No results found',
  'msg.importSuccess': 'Import successful!',
  'msg.exportSuccess': 'Export successful!',
  'msg.syncSuccess': 'Sync completed!',
  'msg.syncError': 'Sync failed!',
  'msg.deleteConfirm': 'Are you sure you want to delete this item?',
  'msg.unsavedChanges': 'You have unsaved changes. Do you want to save?',

  // Errors
  'error.required': 'This field is required',
  'error.invalidUrl': 'Invalid URL',
  'error.invalidFile': 'Invalid file',
  'error.network': 'Network error',
  'error.unknown': 'An unknown error occurred',

  // Notifications
  'notif.saved': 'Saved successfully',
  'notif.deleted': 'Deleted successfully',
  'notif.synced': 'Synced to cloud',
  'notif.imported': 'Imported successfully',
};

// Chinese translations
const zhCN: Record<string, string> = {
  // App
  'app.title': 'OmniCollector',
  'app.subtitle': '资源管理',

  // Actions
  'action.add': '添加',
  'action.save': '保存',
  'action.cancel': '取消',
  'action.delete': '删除',
  'action.edit': '编辑',
  'action.close': '关闭',
  'action.search': '搜索',
  'action.clear': '清除',
  'action.sync': '同步',
  'action.export': '导出',
  'action.import': '导入',
  'action.upload': '上传',
  'action.dragDrop': '拖拽文件到这里',

  // Resource Types
  'type.all': '全部',
  'type.web': '网页',
  'type.word': 'Word',
  'type.pdf': 'PDF',
  'type.epub': 'EPUB',
  'type.image': '图片',
  'type.other': '其他',

  // Views
  'view.listDetail': '列表',
  'view.table': '表格',
  'view.grid': '网格',

  // Sidebar
  'sidebar.library': '资料库',
  'sidebar.recent': '最近',
  'sidebar.uncategorized': '未分类',
  'sidebar.untagged': '未标记',
  'sidebar.trash': '回收站',
  'sidebar.folders': '文件夹',
  'sidebar.tags': '标签',
  'sidebar.colors': '颜色',

  // Filters
  'filter.search': '搜索...',
  'filter.color': '按颜色筛选',
  'filter.tag': '按标签筛选',
  'filter.folder': '按文件夹筛选',

  // Sort
  'sort.dateDesc': '日期 (最新)',
  'sort.dateAsc': '日期 (最早)',
  'sort.nameAsc': '名称 (A-Z)',
  'sort.nameDesc': '名称 (Z-A)',

  // Dialogs
  'dialog.createResource': '创建资源',
  'dialog.editResource': '编辑资源',
  'dialog.createFolder': '创建文件夹',
  'dialog.editFolder': '编辑文件夹',
  'dialog.createTag': '创建标签',
  'dialog.editTag': '编辑标签',
  'dialog.importData': '导入数据',
  'dialog.exportData': '导出数据',
  'dialog.settings': '设置',
  'dialog.auth': '认证',

  // Form Fields
  'form.title': '标题',
  'form.type': '类型',
  'form.url': '链接',
  'form.path': '文件路径',
  'form.description': '描述',
  'form.folder': '文件夹',
  'form.tags': '标签',
  'form.color': '颜色',
  'form.icon': '图标',
  'form.email': '邮箱',
  'form.password': '密码',

  // Settings
  'settings.appearance': '外观',
  'settings.theme': '主题',
  'settings.language': '语言',
  'settings.connection': '连接',
  'settings.supabaseUrl': 'Supabase URL',
  'settings.supabaseKey': 'Anon Key',

  // Auth
  'auth.signIn': '登录',
  'auth.signUp': '注册',
  'auth.signOut': '退出',
  'auth.forgotPassword': '忘记密码？',

  // Messages
  'msg.noItems': '暂无内容',
  'msg.noResults': '未找到结果',
  'msg.importSuccess': '导入成功！',
  'msg.exportSuccess': '导出成功！',
  'msg.syncSuccess': '同步完成！',
  'msg.syncError': '同步失败！',
  'msg.deleteConfirm': '确定要删除此项目吗？',
  'msg.unsavedChanges': '有未保存的更改，是否保存？',

  // Errors
  'error.required': '此字段为必填',
  'error.invalidUrl': '链接格式无效',
  'error.invalidFile': '文件无效',
  'error.network': '网络错误',
  'error.unknown': '发生未知错误',

  // Notifications
  'notif.saved': '保存成功',
  'notif.deleted': '删除成功',
  'notif.synced': '已同步到云端',
  'notif.imported': '导入成功',
};

/**
 * Initialize i18n
 */
export function initI18n(): void {
  // Load saved locale or detect from browser
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved && (saved === 'en' || saved === 'zh_CN')) {
    currentLocale = saved;
  } else if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      currentLocale = 'zh_CN';
    }
  }

  // Load translations
  translations['en'] = en;
  translations['zh_CN'] = zhCN;
}

/**
 * Get current locale
 */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Set locale
 */
export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
}

/**
 * Get translation
 */
export function t(key: string): string {
  const localeTranslations = translations[currentLocale] || translations[DEFAULT_LOCALE];
  return localeTranslations[key] || translations[DEFAULT_LOCALE][key] || key;
}

/**
 * Format date
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = currentLocale === 'zh_CN' ? 'zh-CN' : 'en-US';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (currentLocale === 'zh_CN') {
    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return formatDate(d);
  }

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/**
 * Get available locales
 */
export function getAvailableLocales(): { code: SupportedLocale; name: string }[] {
  return [
    { code: 'en', name: 'English' },
    { code: 'zh_CN', name: '简体中文' }
  ];
}

// Initialize on import
initI18n();
