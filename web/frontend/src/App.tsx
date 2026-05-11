
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/user/Dashboard';
import Profile from './pages/user/Profile';
import History from './pages/user/History';
import AdminDashboard from './pages/admin/AdminDashboard';
import Chat from './pages/user/Chat';

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
      <Route path="/profile"   element={<Layout><Profile /></Layout>} />
      <Route path="/history"   element={<Layout><History /></Layout>} />
      <Route path="/chat"      element={<Layout><Chat /></Layout>} />
      <Route path="/admin"     element={<Layout><AdminDashboard /></Layout>} />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}
