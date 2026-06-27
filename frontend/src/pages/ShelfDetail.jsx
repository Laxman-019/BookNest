import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const ShelfDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shelf, setShelf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [books, setBooks] = useState([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [selectedBook, setSelectedBook] = useState('');
  const [userBooks, setUserBooks] = useState([]);

  useEffect(() => {
    fetchShelfDetail();
  }, [id]);

  const fetchShelfDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/shelves/${id}/`);
      setShelf(response.data);
      setBooks(response.data.books || []);
      setError('');
    } catch (err) {
      setError('Failed to load shelf details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBooks = async () => {
    try {
      const response = await api.get('/books/');
      setUserBooks(response.data.data || []);
    } catch (err) {
      console.error('Failed to load books');
    }
  };

  const handleAddBook = async () => {
    if (!selectedBook) return;
    try {
      await api.post(`/shelves/${id}/books/`, { book_id: selectedBook });
      setShowAddBook(false);
      setSelectedBook('');
      fetchShelfDetail();
    } catch (err) {
      setError('Failed to add book to shelf');
    }
  };

  const handleRemoveBook = async (bookId) => {
    if (!window.confirm('Remove this book from the shelf?')) return;
    try {
      await api.delete(`/shelves/${id}/books/`, { data: { book_id: bookId } });
      fetchShelfDetail();
    } catch (err) {
      setError('Failed to remove book from shelf');
    }
  };

  const handleDeleteShelf = async () => {
    if (!window.confirm('Are you sure you want to delete this shelf?')) return;
    try {
      await api.delete(`/shelves/${id}/`);
      navigate('/shelves');
    } catch (err) {
      setError('Failed to delete shelf');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!shelf) return <ErrorMessage message="Shelf not found" />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <Link to="/shelves" className="text-blue-600 hover:underline mb-2 inline-block">
              ← Back to Shelves
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{shelf.name}</h1>
            <p className="text-gray-600 mt-1">
              {shelf.book_count} books • Created by {shelf.owner_details?.name}
            </p>
          </div>
          
          <div className="flex gap-2">
            {shelf.user_role === 'OWNER' && (
              <>
                <Link
                  to={`/shelves/${id}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Edit Shelf
                </Link>
                <button
                  onClick={handleDeleteShelf}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete Shelf
                </button>
              </>
            )}
          </div>
        </div>

        {shelf.user_role === 'OWNER' && (
          <div className="mb-6">
            <button
              onClick={() => {
                setShowAddBook(!showAddBook);
                if (!showAddBook) fetchUserBooks();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              {showAddBook ? 'Cancel' : '+ Add Book'}
            </button>

            {showAddBook && (
              <div className="mt-4 flex gap-2">
                <select
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a book...</option>
                  {userBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title} by {book.author}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddBook}
                  disabled={!selectedBook}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <div key={book.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition">
              <h3 className="font-semibold text-gray-900">{book.title}</h3>
              <p className="text-sm text-gray-600">by {book.author}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                  {book.status}
                </span>
                {shelf.user_role === 'OWNER' && (
                  <button
                    onClick={() => handleRemoveBook(book.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {books.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No books in this shelf yet</p>
            {shelf.user_role === 'OWNER' && (
              <button
                onClick={() => {
                  setShowAddBook(true);
                  fetchUserBooks();
                }}
                className="text-blue-600 hover:underline mt-2"
              >
                Add your first book
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShelfDetail;