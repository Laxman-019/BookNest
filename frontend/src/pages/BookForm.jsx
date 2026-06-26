import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const BookForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    status: 'WANT_TO_READ',
    total_pages: '',
    current_page: '',
    rating: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetchBook();
    }
  }, [id]);

  const fetchBook = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/books/${id}/`);
      const book = response.data;
      setFormData({
        title: book.title,
        author: book.author,
        status: book.status,
        total_pages: book.total_pages || '',
        current_page: book.current_page || '',
        rating: book.rating || '',
        notes: book.notes || ''
      });
    } catch (err) {
      setError('Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!formData.title.trim()) {
      setError('Title is required');
      setSubmitting(false);
      return;
    }
    if (!formData.author.trim()) {
      setError('Author is required');
      setSubmitting(false);
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        total_pages: formData.total_pages ? parseInt(formData.total_pages) : null,
        current_page: formData.current_page ? parseInt(formData.current_page) : 0,
        rating: formData.rating ? parseInt(formData.rating) : null
      };

      if (isEdit) {
        await api.put(`/books/${id}/`, dataToSend);
      } else {
        await api.post('/books/', dataToSend);
      }
      navigate('/books');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save book');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {isEdit ? 'Edit Book' : 'Add New Book'}
          </h1>

          {error && <ErrorMessage message={error} />}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.title}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author *
                </label>
                <input
                  type="text"
                  name="author"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.author}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="WANT_TO_READ">Want to Read</option>
                  <option value="READING">Reading</option>
                  <option value="FINISHED">Finished</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Pages
                </label>
                <input
                  type="number"
                  name="total_pages"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.total_pages}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Page
                </label>
                <input
                  type="number"
                  name="current_page"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.current_page}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rating (1-5)
                </label>
                <input
                  type="number"
                  name="rating"
                  min="1"
                  max="5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.rating}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : isEdit ? 'Update Book' : 'Add Book'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/books')}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookForm;