import React from 'react';

interface SkeletonLoaderProps {
  isLoading: boolean;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ isLoading }) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75">
      <div className="p-8 bg-white rounded-lg shadow-xl animate-pulse">
        <div className="space-y-4">
          <div className="w-48 h-6 bg-gray-300 rounded"></div>
          <div className="w-64 h-4 bg-gray-300 rounded"></div>
          <div className="flex space-x-4 mt-6">
            <div className="w-24 h-10 bg-gray-300 rounded"></div>
            <div className="w-24 h-10 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-white text-lg font-semibold">Processando, por favor aguarde...</p>
    </div>
  );
};

export default SkeletonLoader;