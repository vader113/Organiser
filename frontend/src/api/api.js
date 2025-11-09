import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
};

export const items = {
  getAll: (params) => api.get('/items', { params }),
  create: (data) => api.post('/items', data),
  upload: (formData) => api.post('/items/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/items/${id}`),
  download: (id) => api.get(`/items/${id}/download`, { responseType: 'blob' }),
};

export const collections = {
  getAll: () => api.get('/collections'),
  create: (name) => api.post('/collections', { name }),
};

export const tags = {
  getAll: () => api.get('/tags'),
  create: (name) => api.post('/tags', { name }),
};

export default api;
