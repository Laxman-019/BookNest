import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/books', label: 'My Books' },
  { to: '/shelves', label: 'Shelves' },
  { to: '/shared-with-me', label: 'Shared With Me' },
  { to: '/borrowed', label: 'Borrowed' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold text-blue-600">BookNest</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => {
              const active = location.pathname === to ||
                             (to !== '/dashboard' && location.pathname.startsWith(to));
              return (
                <Link key={to} to={to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}>
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden md:block">👤 {user?.name}</span>
            
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Toggle menu"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`block w-full h-0.5 bg-gray-600 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block w-full h-0.5 bg-gray-600 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`block w-full h-0.5 bg-gray-600 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>

            <button onClick={handleLogout}
              className="px-4 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
              Logout
            </button>
          </div>
        </div>

        <div className={`md:hidden transition-all duration-300 overflow-hidden ${isMenuOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="py-3 space-y-1 border-t border-gray-100">
            {NAV_LINKS.map(({ to, label }) => {
              const active = location.pathname === to ||
                             (to !== '/dashboard' && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    active 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                  onClick={closeMenu}
                >
                  {label}
                </Link>
              );
            })}
            <div className="px-3 py-2.5 text-sm text-gray-600 border-t border-gray-100 mt-2 pt-3">
              👤 {user?.name}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;