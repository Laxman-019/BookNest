import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const ACTION_ICON = {
  BOOK_ADDED: '📚',
  BOOK_UPDATED: '✏️',
  BOOK_STATUS_CHANGED: '🔄',
  BOOK_LENT: '📤',
  BOOK_RETURNED: '📥',
  SHELF_SHARED: '🤝',
  COLLABORATOR_ROLE_CHANGED: '🔑',
  COLLABORATOR_REMOVED: '❌',
};

// Static colour map avoids Tailwind purging dynamic class names
const CARD_STYLES = {
  slate: 'border-l-4 border-slate-400',
  yellow: 'border-l-4 border-yellow-400',
  blue: 'border-l-4 border-blue-400',
  green: 'border-l-4 border-green-400',
  purple: 'border-l-4 border-purple-400',
  orange: 'border-l-4 border-orange-400',
  indigo: 'border-l-4 border-indigo-400',
  teal: 'border-l-4 border-teal-400',
};

const VALUE_STYLES = {
  slate: 'text-slate-700',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
  indigo: 'text-indigo-600',
  teal: 'text-teal-600',
};

const StatCard = ({ label, value, sub, color = 'blue' }) => (
  <div className={`bg-white rounded-xl shadow-sm p-5 ${CARD_STYLES[color]}`}>
    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
    <p className={`text-3xl font-bold mt-1 ${VALUE_STYLES[color]}`}>{value ?? '—'}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/');
      setStats(res.data);
      setActivities(res.data.recent_activities || []);
      setError('');
    } catch {
      setError('Failed to load dashboard. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const handler = (e) => {
      setActivities(prev => [e.detail, ...prev].slice(0, 20));
    };
    window.addEventListener('ws:activity_created', handler);
    return () => window.removeEventListener('ws:activity_created', handler);
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's your reading overview</p>
        </div>

        {error && <ErrorMessage message={error} />}

        {stats && (
          <>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              My Library
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Books" value={stats.total_books} color="slate"  />
              <StatCard label="Want to Read" value={stats.status_counts?.WANT_TO_READ} color="yellow" />
              <StatCard label="Currently Reading" value={stats.status_counts?.READING} color="blue"   />
              <StatCard label="Finished" value={stats.status_counts?.FINISHED} color="green"  />
            </div>

            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Insights
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Finished This Year"
                value={stats.finished_this_year}
                color="purple"
              />
              <StatCard
                label="Average Rating"
                value={stats.average_rating ? `${stats.average_rating} ⭐` : 'No ratings'}
                color="yellow"
              />
              <StatCard
                label="Top Shelf"
                value={stats.top_shelf?.name ?? 'None yet'}
                sub={stats.top_shelf ? `${stats.top_shelf.book_count} books` : ''}
                color="indigo"
              />
              <StatCard
                label="Books Lent Out"
                value={stats.books_lent_out}
                color="orange"
              />
            </div>

            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Social
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Shelves Shared With Me"
                value={stats.shelves_shared_with_me}
                color="teal"
              />
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link to="/books/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                + Add Book
              </Link>
              <Link to="/books"
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                My Books
              </Link>
              <Link to="/shelves"
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                My Shelves
              </Link>
              <Link to="/borrowed"
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                Borrowed Books
              </Link>
              <Link to="/shared-with-me"
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                Shared With Me
              </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  ● Live
                </span>
              </div>

              {activities.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                  No activity yet — start adding books!
                </p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {activities.map((a, i) => (
                    <li key={a.id ?? i} className="flex items-start gap-3 py-3 text-sm">
                      <span className="text-xl leading-none mt-0.5 shrink-0">
                        {ACTION_ICON[a.action] ?? '📌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 leading-snug">{a.description}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
