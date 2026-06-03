import axios from 'axios';
import { faker } from '@faker-js/faker';
import { 
  fetchAudiobookFromOpenLibrary, 
  formatDuration, 
  searchAudiobooks,
  browseAudiobooks
} from '../audiobookMetadataService';
import { supabase } from '../../api/supabase';

// Mock Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Supabase
jest.mock('../../api/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
    }))
  }
}));

describe('audiobookMetadataService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAudiobookFromOpenLibrary', () => {
    const mockIsbn = '9780307474278';
    
    it('should return formatted metadata when book is found', async () => {
      const mockData = {
        [`ISBN:${mockIsbn}`]: {
          title: 'The Da Vinci Code',
          authors: [{ name: 'Dan Brown' }],
          publishers: [{ name: 'Anchor' }],
          cover: { large: 'https://cover.url' },
          publish_date: '2009',
          description: 'A thriller novel'
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const result = await fetchAudiobookFromOpenLibrary(mockIsbn);
      
      expect(result).toEqual({
        title: 'The Da Vinci Code',
        author: 'Dan Brown',
        publisher: 'Anchor',
        cover_url: 'https://cover.url',
        published_at: '2009',
        description: 'A thriller novel'
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(mockIsbn),
        expect.any(Object)
      );
    });

    it('should return null when book is not found', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} });
      const result = await fetchAudiobookFromOpenLibrary(mockIsbn);
      expect(result).toBeNull();
    });

    it('should throw error when API fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
      await expect(fetchAudiobookFromOpenLibrary(mockIsbn)).rejects.toThrow('OpenLibrary API failure');
    });
  });

  describe('searchAudiobooks', () => {
    it('should return results from supabase RPC', async () => {
      const mockResults = Array.from({ length: 3 }).map(() => ({
        id: faker.string.uuid(),
        title: faker.commerce.productName(),
        author: faker.person.fullName()
      }));

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: mockResults, error: null });

      const results = await searchAudiobooks('Harry Potter');
      
      expect(results).toHaveLength(3);
      expect(supabase.rpc).toHaveBeenCalledWith('search_audiobooks', {
        query: 'Harry Potter',
        lim: 20
      });
    });

    it('should return empty array on error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'DB Error' } });
      const results = await searchAudiobooks('test');
      expect(results).toEqual([]);
    });
  });

  describe('browseAudiobooks', () => {
    it('should correctly build query and return paginated data', async () => {
      const mockData = [{ id: '1', title: 'Audiobook 1' }];
      const mockSelect = supabase.from('test').select();
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (cb: any) => cb({ data: mockData, count: 1, error: null })
      });

      const result = await browseAudiobooks({ 
        platform: 'fonos', 
        page: 1, 
        pageSize: 10 
      });

      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(1);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds to hours and minutes correctly', () => {
      expect(formatDuration(3660)).toBe('1 giờ 1 phút');
      expect(formatDuration(7200)).toBe('2 giờ 0 phút');
      expect(formatDuration(1800)).toBe('30 phút');
      expect(formatDuration(null)).toBe('');
    });
  });
});
