import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const Books = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    sort_by: '-created_at',
    page: 1,
    page_size: 12
  });
  const [pagination, setPagination] = useState({});

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/books/', { params: filters });
      setBooks(response.data.data);
      setPagination(response.data.pagination);
      setError('');
    } catch (err) {
      setError('Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [filters]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    try {
      await api.delete(`/books/${id}/`);
      fetchBooks();
    } catch (err) {
      setError('Failed to delete book');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'WANT_TO_READ': 'bg-yellow-100 text-yellow-800',
      'READING': 'bg-blue-100 text-blue-800',
      'FINISHED': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => status.replace('_', ' ');

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Books</h1>
          <Link
            to="/books/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Add Book
          </Link>
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search by title or author..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
            />
            
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
            >
              <option value="">All Status</option>
              <option value="WANT_TO_READ">Want to Read</option>
              <option value="READING">Reading</option>
              <option value="FINISHED">Finished</option>
            </select>
            
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={filters.sort_by}
              onChange={(e) => setFilters({...filters, sort_by: e.target.value})}
            >
              <option value="-created_at">Newest First</option>
              <option value="created_at">Oldest First</option>
              <option value="title">Title A-Z</option>
              <option value="-title">Title Z-A</option>
              <option value="-rating">Highest Rating</option>
              <option value="rating">Lowest Rating</option>
            </select>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No books found</p>
            <Link to="/books/new" className="text-blue-600 hover:underline">
              Add your first book
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map((book) => (
                <div key={book.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg truncate">
                        {book.title}
                      </h3>
                      {book.is_lent && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                          Lent
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">by {book.author}</p>
                    
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(book.status)}`}>
                      {getStatusLabel(book.status)}
                    </span>
                    
                    {book.total_pages && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Progress</span>
                          <span>{book.current_page}/{book.total_pages}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${book.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {book.rating && (
                      <div className="mt-2 text-sm text-yellow-500">
                        {'⭐'.repeat(book.rating)}
                      </div>
                    )}
                    
                    <div className="mt-4 flex gap-2">
                      <Link
                        to={`/books/${book.id}/edit`}
                        className="flex-1 text-center px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(book.id)}
                        className="flex-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination.total_pages > 1 && (
              <div className="mt-6 flex justify-center gap-2">
                <button
                  className="px-3 py-1 border rounded-lg hover:bg-gray-50"
                  onClick={() => setFilters({...filters, page: Math.max(1, filters.page - 1)})}
                  disabled={filters.page === 1}
                >
                  Previous
                </button>
                
                {[...Array(pagination.total_pages)].map((_, i) => (
                  <button
                    key={i}
                    className={`px-3 py-1 border rounded-lg ${
                      filters.page === i + 1 
                        ? 'bg-blue-600 text-white' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setFilters({...filters, page: i + 1})}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  className="px-3 py-1 border rounded-lg hover:bg-gray-50"
                  onClick={() => setFilters({...filters, page: Math.min(pagination.total_pages, filters.page + 1)})}
                  disabled={filters.page === pagination.total_pages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Books;