/**
 * Test suite: Supabase client config
 * Tests the client is configured correctly via the manual mock
 */
import { supabase } from '../api/supabase';

describe('Supabase client', () => {
  it('should export a supabase client object', () => {
    expect(supabase).toBeDefined();
  });

  it('should have auth property', () => {
    expect(supabase.auth).toBeDefined();
  });

  it('should have from method for table queries', () => {
    expect(typeof supabase.from).toBe('function');
  });

  it('supabase.from() should return an object with select', async () => {
    const result = supabase.from('books');
    expect(typeof result.select).toBe('function');
  });

  it('supabase.from().select() should resolve with data array', async () => {
    const { data } = await supabase.from('books').select('*');
    expect(Array.isArray(data)).toBe(true);
  });
});
