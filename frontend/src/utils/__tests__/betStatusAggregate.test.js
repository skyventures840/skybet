import { aggregateBetStatus } from '../../utils/betStatusAggregate';

describe('aggregateBetStatus', () => {
  test('returns won when all legs are won (BTTS Yes single)', () => {
    const result = aggregateBetStatus(['won'], 'pending');
    expect(result).toBe('won');
  });

  test('returns pending when any leg is pending', () => {
    const result = aggregateBetStatus(['won', 'pending'], 'lost');
    expect(result).toBe('pending');
  });

  test('returns lost when any leg is lost', () => {
    const result = aggregateBetStatus(['won', 'lost', 'won'], 'pending');
    expect(result).toBe('lost');
  });

  test('returns void when any leg is void and none are lost', () => {
    const result = aggregateBetStatus(['won', 'void', 'won'], 'pending');
    expect(result).toBe('void');
  });

  test('falls back to provided status when list is empty', () => {
    const result = aggregateBetStatus([], 'won');
    expect(result).toBe('won');
  });
});

