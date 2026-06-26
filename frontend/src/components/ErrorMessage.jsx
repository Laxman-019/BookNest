import React from 'react';

const ErrorMessage = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      <div className="flex items-center">
        <span className="text-lg mr-2">⚠️</span>
        <span>{message}</span>
      </div>
    </div>
  );
};

export default ErrorMessage;