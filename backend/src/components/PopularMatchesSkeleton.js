import SkeletonLoader from './SkeletonLoader';

// Legacy wrapper for backward compatibility
const PopularMatchesSkeleton = () => {
  return <SkeletonLoader type="popular-matches" count={6} title="Popular Matches" />;
};

export default PopularMatchesSkeleton;