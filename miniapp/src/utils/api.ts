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

// ---- Контракты ----
export const contracts = {
  create: (data: any)             => api.post('/contracts', data),
  get:    (id: string)            => api.get(`/contracts/${id}`),
  sign:   (id: string, role: string) => api.post(`/contracts/${id}/sign`, { role }),
  deploy: (id: string, data: any) => api.post(`/contracts/${id}/deploy`, data),
  approve:(id: string)            => api.post(`/contracts/${id}/approve`),
};

// ---- Сдача работы ----
export const deliveries = {
  submit: (formData: FormData)    => api.post('/deliveries', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  approve: (id: string)           => api.post(`/deliveries/${id}/approve`),
  reject:  (id: string, comment: string) => api.post(`/deliveries/${id}/reject`, { comment }),
  previewUrl: (fileId: string)    => `/api/deliveries/preview/${fileId}`,
};

// ---- Споры ----
export const disputes = {
  open:    (data: any)            => api.post('/disputes', data),
  resolve: (id: string, data: any) => api.post(`/disputes/${id}/resolve`, data),
};

// ---- Пользователи ----
export const users = {
  me:          ()              => api.get('/users/me'),
  setWallet:   (addr: string)  => api.patch('/users/me/wallet', { walletAddress: addr }),
  portfolio:   (tgId: number)  => api.get(`/users/${tgId}/portfolio`),
  reviews:     (tgId: number)  => api.get(`/users/${tgId}/reviews`),
};

// ---- Биржа заказов ----
export const jobs = {
  list:    (params?: any)      => api.get('/jobs', { params }),
  create:  (data: any)         => api.post('/jobs', data),
  apply:   (id: string, data: any) => api.post(`/jobs/${id}/apply`, data),
};

export default api;
