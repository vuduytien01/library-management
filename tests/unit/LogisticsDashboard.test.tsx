import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LogisticsDashboard } from '../../src/features/admin/components/LogisticsDashboard';

// supabase is now automatically mocked by jest.config.js moduleNameMapper
// pointing to tests/__mocks__/api/supabase.js
const { supabase } = require('@/src/api/supabase');

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'admin.priority_high') return 'Ưu tiên: Cao';
      if (key === 'admin.priority_standard') return 'Tiêu chuẩn';
      return key;
    },
  }),
}));

describe('LogisticsDashboard - Priority Labels', () => {
  const mockTasks = [
    {
      id: '1',
      book_title: 'Sách A',
      from_branch: { name: 'Chi nhánh 1', province_v2_id: 1, latitude: 21, longitude: 105 },
      to_branch: { name: 'Chi nhánh 2', province_v2_id: 4, latitude: 10, longitude: 106 }, // Khác vùng -> National
      status: 'PENDING',
      quantity: 1,
    }
  ];

  it('should display "Ưu tiên: Cao" for National transfers', async () => {
    // Setup mock data for National transfer
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      neq: jest.fn().mockResolvedValue({ data: mockTasks, error: null }),
    });

    render(<LogisticsDashboard />);
    
    // Wait for data to load
    const priorityLabel = await screen.findByText(/Ưu tiên: Cao/);
    expect(priorityLabel).toBeTruthy();
  });

  it('should display "Tiêu chuẩn" for Regional transfers', async () => {
    // Setup mock data for Regional transfer (Hanoi to Haiphong, both RED_RIVER_DELTA)
    const regionalTasks = [{
      id: 'task-2',
      book_title: 'Sách vùng',
      quantity: 5,
      from_branch: { name: 'Hà Nội', province_v2_id: 1 },
      to_branch: { name: 'Hải Phòng', province_v2_id: 2 },
      status: 'PENDING'
    }];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      neq: jest.fn().mockResolvedValue({ data: regionalTasks, error: null }),
    });

    render(<LogisticsDashboard />);
    
    const priorityLabel = await screen.findByText(/Tiêu chuẩn/);
    expect(priorityLabel).toBeTruthy();
    expect(screen.queryByText(/Ưu tiên: Cao/)).toBeNull();
  });

  it('should display empty state when no tasks are returned', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      neq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    render(<LogisticsDashboard />);
    
    const emptyText = await screen.findByText(/admin.no_logs/); // key because t returns key
    expect(emptyText).toBeTruthy();
  });
});
