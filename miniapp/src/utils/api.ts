import axios from 'axios';

// ============================================================
// API клиент — все запросы к SafeDeal backend
// ============================================================

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// Добавляем Telegram initData в каждый запрос
api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    config.headers['X-Telegram-Init-Data'] = initData;
  }
  return config;
});

// ---- AI помощник по заказу (PRO) ----
export const ai = {
  draftDeal: (messages: { role: 'user' | 'assistant'; content: string }[]) =>
    api.post('/ai/draft-deal', { messages }),
};

// ---- Кристаллы (soft-валюта) ----
export const crystals = {
  get:            ()              => api.get('/crystals'),
  shop:           ()              => api.get('/crystals/shop'),
  spend:          (key: string)   => api.post(`/crystals/spend/${key}`),
  packages:       ()              => api.get('/crystals/packages'),
  buyPackage:     (id: number)    => api.post(`/crystals/packages/${id}/purchase`),
  confirmPackage: (body: { package_id: number; tx_hash: string }) => api.post('/crystals/packages/confirm', body),
};

// ---- Контракты ----
export const contracts = {
  create: (data: any)             => api.post('/contracts', data),
  get:    (id: string)            => api.get(`/contracts/${id}`),
  estimate: (id: string)          => api.get(`/contracts/${id}/estimate`),
  sign:   (id: string, role: string) => api.post(`/contracts/${id}/sign`, { role }),
  deploy: (id: string, data: any) => api.post(`/contracts/${id}/deploy`, data),
  approve:         (id: string)   => api.post(`/contracts/${id}/approve`),
  simulatePayment: (id: string)   => api.post(`/contracts/${id}/simulate-payment`),
  review: (id: string, body: { rating: number; comment?: string }) => api.post(`/contracts/${id}/review`, body),
  createMilestoneDeal: (body: any) => api.post('/contracts/milestone-deal', body),
  group: (groupId: string) => api.get(`/contracts/group/${groupId}`),
};

// ---- Сдача работы ----
export const deliveries = {
  submit:           (formData: FormData)             => api.post('/deliveries', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  get:              (id: string)                     => api.get(`/deliveries/${id}`),
  getByContractId:  (contractId: string)             => api.get(`/deliveries/by-contract/${contractId}`),
  approve:          (id: string)                     => api.post(`/deliveries/${id}/approve`),
  reject:           (id: string, comment: string)    => api.post(`/deliveries/${id}/reject`, { comment }),
  previewUrl:       (fileId: string)                 => `/api/deliveries/preview/${fileId}`,
};

// ---- Споры ----
export const disputes = {
  open:         (data: any)             => api.post('/disputes', data),
  resolve:      (id: string, data: any) => api.post(`/disputes/${id}/resolve`, data),
  byContract:   (contractId: string)    => api.get(`/disputes/by-contract/${contractId}`),
};

// ---- Пользователи ----
export const users = {
  me:            ()                          => api.get('/users/me'),
  analytics:     ()                          => api.get('/users/analytics'),
  myDeals:       ()                          => api.get('/users/me/deals'),
  setWallet:     (addr: string)              => api.patch('/users/me/wallet', { walletAddress: addr }),
  portfolio:     (tgId: number)              => api.get(`/users/${tgId}/portfolio`),
  reviews:       (tgId: number)              => api.get(`/users/${tgId}/reviews`),
  updateProfile:  (data: any)                  => api.patch('/users/me/profile', data),
  getPublic:      (telegramId: number | string) => api.get(`/users/${telegramId}`),
  freelancers:    ()                            => api.get('/users/freelancers'),
  uploadBanner:   (file: File) => {
    const fd = new FormData(); fd.append('banner', file);
    return api.post('/users/me/banner', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadAvatar:   (file: File) => {
    const fd = new FormData(); fd.append('avatar', file);
    return api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  addSlide:       (file: File) => {
    const fd = new FormData(); fd.append('slide', file);
    return api.post('/users/me/slides', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteSlide:    (index: number) => api.delete(`/users/me/slides/${index}`),
};

// ---- Комнаты ----
export const rooms = {
  join: (inviteLink: string) => api.get(`/rooms/join/${inviteLink}`),
};

// ---- Уведомления ----
export const notifications = {
  list:        ()          => api.get('/notifications'),
  unreadCount: ()          => api.get('/notifications/unread-count'),
  readAll:     ()          => api.patch('/notifications/read-all'),
  read:        (id: string) => api.patch(`/notifications/${id}/read`),
};

// ---- Live Feed ----
export const livefeed = {
  get: () => api.get('/livefeed'),
};

// ---- Биржа заказов ----
export const jobs = {
  list:         (params?: any)          => api.get('/jobs', { params }),
  my:           ()                      => api.get('/jobs/my'),
  create:       (data: any)             => api.post('/jobs', data),
  apply:        (id: string, data: any) => api.post(`/jobs/${id}/apply`, data),
  applications: (id: string)            => api.get(`/jobs/${id}/applications`),
};

// ---- Квесты ----
export const quests = {
  list:  ()            => api.get('/quests'),
  claim: (key: string) => api.post(`/quests/${key}/claim`),
};

export default api;
