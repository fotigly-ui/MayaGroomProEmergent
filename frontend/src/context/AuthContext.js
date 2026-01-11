import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, settingsAPI } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('maya_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [userRes, settingsRes] = await Promise.all([
        authAPI.getMe(),
        settingsAPI.get()
      ]);
      setUser(userRes.data);
      setSettings(settingsRes.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('maya_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    localStorage.setItem('maya_token', response.data.access_token);
    await checkAuth();
    return response.data;
  };

  const register = async (email, password, businessName) => {
    const response = await authAPI.register({ 
      email, 
      password, 
      business_name: businessName 
    });
    localStorage.setItem('maya_token', response.data.access_token);
    await checkAuth();
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('maya_token');
    setUser(null);
    setSettings(null);
    setIsAuthenticated(false);
  };

  const updateSettings = async (data) => {
    const response = await settingsAPI.update(data);
    setSettings(response.data);
    return response.data;
  };

  const value = {
    user,
    settings,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateSettings,
    refreshSettings: checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
