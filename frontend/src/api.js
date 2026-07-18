import axios from "axios";


const API = axios.create({
  baseURL: "http://107.21.170.243:5000/api",
});

// Interceptor: automatically adds JWT token to EVERY request
// So you don't have to manually add it in Login.js, Dashboard.js, etc.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;