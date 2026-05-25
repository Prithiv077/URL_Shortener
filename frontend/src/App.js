import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login     from "./pages/Login";
import Register  from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import "./App.css";

// Check if user is logged in by looking for token in localStorage
const isLoggedIn = () => !!localStorage.getItem("token");

// Wrapper that blocks unauthenticated users from the dashboard
const PrivateRoute = ({ children }) => {
  return isLoggedIn() ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        {/* Redirect unknown routes based on login status */}
        <Route path="*" element={<Navigate to={isLoggedIn() ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;