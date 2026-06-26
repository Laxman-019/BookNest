import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p className="mt-3 text-gray-600">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;