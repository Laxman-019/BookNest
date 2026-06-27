import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const SharedShelves = () => {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSharedShelves = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shelves/shared-with-me/');
      setShelves(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load shared shelves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedShelves();
  }, []);

  const getRoleColor = (role) => {
    return role === 'EDITOR' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Shared With Me</h1>

        {error && <ErrorMessage message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shelves.map((shelf) => (
            <div key={shelf.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 text-lg">{shelf.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Owned by {shelf.owner_details?.name}
                </p>
                <p className="text-sm text-gray-600">
                  {shelf.book_count} books
                </p>
                <div className="mt-3">
                  <span className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleColor(shelf.shared_role)}`}>
                    {shelf.shared_role}
                  </span>
                </div>
                <div className="mt-4">
                  <Link
                    to={`/shelves/${shelf.id}`}
                    className="block text-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    View Shelf
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {shelves.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No shelves shared with you yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedShelves;