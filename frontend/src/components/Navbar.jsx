import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold text-blue-600">BookNest</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <Link to="/books" className="text-gray-700 hover:text-blue-600 transition">
              My Books
            </Link>
            <Link to="/shelves" className="text-gray-700 hover:text-blue-600 transition">
              Shelves
            </Link>
            <Link to="/shared-with-me" className="text-gray-700 hover:text-blue-600 transition">
              Shared With Me
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">👤 {user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;