import React from 'react';

export const SkeletonCard = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton-poster shimmer"></div>
      <div className="skeleton-content">
        <div className="skeleton-title shimmer"></div>
        <div className="skeleton-subtitle shimmer"></div>
      </div>
    </div>
  );
};

export const SkeletonGrid = ({ count = 12 }) => {
  return (
    <div className="movies-grid">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
};

export default SkeletonGrid;
