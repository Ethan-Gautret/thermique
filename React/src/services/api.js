import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true,
});

// Ajouter le token dans les headers si présent
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authService = {
  login: (email, password) =>
    api.post("/login", { email, password }).then((res) => {
      if (res.data.token) {
        localStorage.setItem("auth_token", res.data.token);
      }
      return res.data;
    }),

  register: (name, email, password, password_confirmation) =>
    api.post("/register", { name, email, password, password_confirmation }).then((res) => {
      if (res.data.token) {
        localStorage.setItem("auth_token", res.data.token);
      }
      return res.data;
    }),

  logout: () => {
    localStorage.removeItem("auth_token");
    return api.post("/logout");
  },

  getCurrentUser: () =>
    api.get("/user"),

  isAuthenticated: () => {
    return !!localStorage.getItem("auth_token");
  },

  getToken: () => {
    return localStorage.getItem("auth_token");
  },
};

export default api;