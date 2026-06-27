import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const Shelves = () => {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchShelves = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shelves/');
      setShelves(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load shelves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShelves();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shelf?')) return;
    try {
      await api.delete(`/shelves/${id}/`);
      fetchShelves();
    } catch (err) {
      setError('Failed to delete shelf');
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      'OWNER': 'bg-purple-100 text-purple-800',
      'EDITOR': 'bg-blue-100 text-blue-800',
      'VIEWER': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Shelves</h1>
          <Link
            to="/shelves/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Create Shelf
          </Link>
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shelves.map((shelf) => (
            <div key={shelf.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 text-lg">{shelf.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadge(shelf.user_role)}`}>
                    {shelf.user_role}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">
                  {shelf.book_count} books • Created by {shelf.owner_details?.name}
                </p>
                
                <div className="flex gap-2">
                  <Link
                    to={`/shelves/${shelf.id}`}
                    className="flex-1 text-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    View
                  </Link>
                  
                  {shelf.user_role === 'OWNER' && (
                    <>
                      <Link
                        to={`/shelves/${shelf.id}/edit`}
                        className="flex-1 text-center px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(shelf.id)}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {shelves.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No shelves yet</p>
            <Link to="/shelves/new" className="text-blue-600 hover:underline">
              Create your first shelf
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Shelves;