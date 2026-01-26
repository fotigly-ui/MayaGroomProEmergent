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
    console.log('🔐 checkAuth called, token exists:', !!token);
    if (!token) {
      console.log('❌ No token found');
      setLoading(false);
      return;
    }

    try {
      console.log('🔐 Fetching user and settings...');
      const [userRes, settingsRes] = await Promise.all([
        authAPI.getMe(),
        settingsAPI.get()
      ]);
      console.log('✅ User data:', userRes.data);
      console.log('✅ Settings data received');
      setUser(userRes.data);
      setSettings(settingsRes.data);
      setIsAuthenticated(true);
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      localStorage.removeItem('maya_token');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    console.log('🔐 Login attempt for:', email);
    const response = await authAPI.login({ email, password });
    console.log('✅ Login API response received');
    localStorage.setItem('maya_token', response.data.access_token);
    console.log('✅ Token saved to localStorage');
    await checkAuth();
    console.log('✅ checkAuth completed');
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
