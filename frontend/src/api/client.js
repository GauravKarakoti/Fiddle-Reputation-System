import axios from 'axios'

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use( 
  (res) => res,
  (err) => {
    console.error('[API Error]', err.response?.data || err.message)
    return Promise.reject(err)
  }
)

// ── Restaurants ───────────────────────────────────────────────────────────────
export const getRestaurants = (params = {}) =>
  api.get('/api/restaurants', { params }).then(r => r.data)

export const getRestaurant = (id) =>
  api.get(`/api/restaurants/${id}`).then(r => r.data)

export const createRestaurant = (data) =>
  api.post('/api/restaurants', data).then(r => r.data)

// ── Reviews ───────────────────────────────────────────────────────────────────
export const getReviews = (restaurantId, params = {}) =>
  api.get(`/api/reviews/${restaurantId}`, { params }).then(r => r.data)

export const triggerScrape = (restaurantId, payload = {}) =>
  api.post(`/api/scrape/${restaurantId}`, payload).then(r => r.data)

export const getScrapeStatus = (jobId) =>
  api.get(`/api/scrape/status/${jobId}`).then(r => r.data)

export const processNLP = (restaurantId) =>
  api.post('/api/reviews/process-nlp', null, {
    params: { restaurant_id: restaurantId }
  }).then(r => r.data)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getOverview = () =>
  api.get('/api/analytics/overview').then(r => r.data)

export const getOutletAnalytics = (restaurantId, period = '30d') =>
  api.get(`/api/analytics/${restaurantId}`, { params: { period } }).then(r => r.data)

export const getRatingTrend = (restaurantId, period = '90d') =>
  api.get('/api/analytics/trend/rating', {
    params: { restaurant_id: restaurantId, period }
  }).then(r => r.data)

export const getOutletComparison = () =>
  api.get('/api/analytics/comparison/outlets').then(r => r.data)

// ── AI Insights ───────────────────────────────────────────────────────────────
export const generateInsights = (restaurantId, forceRefresh = false) =>
  api.post(`/api/insights/${restaurantId}`, null, {
    params: { force_refresh: forceRefresh }
  }).then(r => r.data)

export const getInsights = (restaurantId) =>
  api.get(`/api/insights/${restaurantId}`).then(r => r.data)

// ── Seed ──────────────────────────────────────────────────────────────────────
export const seedDemo = () =>
  api.post('/api/seed').then(r => r.data)

export default api
