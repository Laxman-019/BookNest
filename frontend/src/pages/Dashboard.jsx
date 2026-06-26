import React from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to BookNest! 👋
          </h1>
          <p className="text-gray-600">
            You are logged in as <strong>{user?.name}</strong> ({user?.email})
          </p>
          <p className="text-gray-600 mt-2">
            Your dashboard will be ready soon!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;