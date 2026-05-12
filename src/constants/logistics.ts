export type StrategicRegion = 
  | 'NORTHERN_HIGHLANDS' // Trung du và miền núi phía Bắc
  | 'RED_RIVER_DELTA'    // Đồng bằng sông Hồng
  | 'NORTH_CENTRAL'      // Bắc Trung Bộ
  | 'SOUTH_CENTRAL'      // Duyên hải Nam Trung Bộ
  | 'CENTRAL_HIGHLANDS'  // Tây Nguyên
  | 'SOUTHEAST'          // Đông Nam Bộ
  | 'MEKONG_DELTA';      // Đồng bằng sông Cửu Long

export interface ProvinceV2 {
  id: number;
  name: string;
  region: StrategicRegion;
}

export const PROVINCES_34: ProvinceV2[] = [
  { id: 1, name: 'Thành phố Hà Nội', region: 'RED_RIVER_DELTA' },
  { id: 2, name: 'Thành phố Hải Phòng', region: 'RED_RIVER_DELTA' },
  { id: 3, name: 'Thành phố Đà Nẵng', region: 'SOUTH_CENTRAL' },
  { id: 4, name: 'Thành phố Hồ Chí Minh', region: 'SOUTHEAST' },
  { id: 5, name: 'Thành phố Cần Thơ', region: 'MEKONG_DELTA' },
  { id: 6, name: 'Thành phố Huế', region: 'NORTH_CENTRAL' },
  { id: 7, name: 'Bắc Ninh', region: 'RED_RIVER_DELTA' },
  { id: 8, name: 'Phú Thọ', region: 'NORTHERN_HIGHLANDS' },
  { id: 9, name: 'Thái Nguyên', region: 'NORTHERN_HIGHLANDS' },
  { id: 10, name: 'Lạng Sơn', region: 'NORTHERN_HIGHLANDS' },
  { id: 11, name: 'Hà Tuyên', region: 'NORTHERN_HIGHLANDS' },
  { id: 12, name: 'Lào Yên', region: 'NORTHERN_HIGHLANDS' },
  { id: 13, name: 'Sơn La', region: 'NORTHERN_HIGHLANDS' },
  { id: 14, name: 'Hòa Bình', region: 'NORTHERN_HIGHLANDS' },
  { id: 15, name: 'Quảng Ninh', region: 'NORTHERN_HIGHLANDS' },
  { id: 16, name: 'Hải Hưng', region: 'RED_RIVER_DELTA' },
  { id: 17, name: 'Thái Bình', region: 'RED_RIVER_DELTA' },
  { id: 18, name: 'Nam Hà', region: 'RED_RIVER_DELTA' },
  { id: 19, name: 'Ninh Bình', region: 'RED_RIVER_DELTA' },
  { id: 20, name: 'Thanh Hóa', region: 'NORTH_CENTRAL' },
  { id: 21, name: 'Nghệ Tĩnh', region: 'NORTH_CENTRAL' },
  { id: 22, name: 'Quảng Bình', region: 'NORTH_CENTRAL' },
  { id: 23, name: 'Quảng Nam', region: 'SOUTH_CENTRAL' },
  { id: 24, name: 'Quảng Ngãi', region: 'SOUTH_CENTRAL' },
  { id: 25, name: 'Bình Định', region: 'SOUTH_CENTRAL' },
  { id: 26, name: 'Phú Khánh', region: 'SOUTH_CENTRAL' },
  { id: 27, name: 'Thuận Hải', region: 'SOUTH_CENTRAL' },
  { id: 28, name: 'Gia Kon', region: 'CENTRAL_HIGHLANDS' },
  { id: 29, name: 'Đắk Lắk', region: 'CENTRAL_HIGHLANDS' },
  { id: 30, name: 'Lâm Đồng', region: 'CENTRAL_HIGHLANDS' },
  { id: 31, name: 'Sông Bé', region: 'SOUTHEAST' },
  { id: 32, name: 'Đồng Nai', region: 'SOUTHEAST' },
  { id: 33, name: 'Bà Rịa - Vũng Tàu', region: 'SOUTHEAST' },
  { id: 34, name: 'Tây Ninh', region: 'SOUTHEAST' },
  // ... Mekong Delta provinces will be mapped similarly
];
