import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('maya_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('maya_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Settings
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Clients
export const clientsAPI = {
  list: (search = '') => api.get(`/clients?search=${search}`),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
};

// Pets
export const petsAPI = {
  list: (clientId = '') => api.get(`/pets?client_id=${clientId}`),
  get: (id) => api.get(`/pets/${id}`),
  create: (data) => api.post('/pets', data),
  update: (id, data) => api.put(`/pets/${id}`, data),
  delete: (id) => api.delete(`/pets/${id}`),
};

// Services
export const servicesAPI = {
  list: () => api.get('/services'),
  get: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

// Items
export const itemsAPI = {
  list: () => api.get('/items'),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

// Appointments
export const appointmentsAPI = {
  list: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('start_date', params.startDate);
    if (params.endDate) queryParams.append('end_date', params.endDate);
    if (params.clientId) queryParams.append('client_id', params.clientId);
    if (params.status) queryParams.append('status', params.status);
    return api.get(`/appointments?${queryParams.toString()}`);
  },
  get: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id, config = {}) => api.delete(`/appointments/${id}`, config),
};

// Waitlist
export const waitlistAPI = {
  list: () => api.get('/waitlist'),
  create: (data) => api.post('/waitlist', data),
  update: (id, data) => api.put(`/waitlist/${id}`, data),
  delete: (id) => api.delete(`/waitlist/${id}`),
};

// Recurring Templates
export const recurringAPI = {
  list: () => api.get('/recurring-templates'),
  create: (data) => api.post('/recurring-templates', data),
  toggle: (id, active) => api.put(`/recurring-templates/${id}?active=${active}`),
  delete: (id) => api.delete(`/recurring-templates/${id}`),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

export default api;
