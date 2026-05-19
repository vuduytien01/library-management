export type StrategicRegion =
  | "NORTHERN_HIGHLANDS" // Trung du và miền núi phía Bắc
  | "RED_RIVER_DELTA" // Đồng bằng sông Hồng
  | "NORTH_CENTRAL" // Bắc Trung Bộ
  | "SOUTH_CENTRAL" // Duyên hải Nam Trung Bộ
  | "CENTRAL_HIGHLANDS" // Tây Nguyên
  | "SOUTHEAST" // Đông Nam Bộ
  | "MEKONG_DELTA"; // Đồng bằng sông Cửu Long

export interface ProvinceV2 {
  id: number;
  name: string;
  region: StrategicRegion;
}

export const PROVINCES_34: ProvinceV2[] = [
  // Consolidated Units from Image
  { id: 1, name: "TP. Hà Nội", region: "RED_RIVER_DELTA" },
  { id: 2, name: "TP. Hải Phòng", region: "RED_RIVER_DELTA" },
  { id: 3, name: "TP. Đà Nẵng", region: "SOUTH_CENTRAL" },
  { id: 4, name: "TP. Hồ Chí Minh", region: "SOUTHEAST" },
  { id: 5, name: "TP. Cần Thơ", region: "MEKONG_DELTA" },
  { id: 6, name: "TP. Huế", region: "NORTH_CENTRAL" },
  { id: 7, name: "Tuyên Quang", region: "NORTHERN_HIGHLANDS" },
  { id: 8, name: "Lào Cai", region: "NORTHERN_HIGHLANDS" },
  { id: 9, name: "Thái Nguyên", region: "NORTHERN_HIGHLANDS" },
  { id: 10, name: "Phú Thọ", region: "NORTHERN_HIGHLANDS" },
  { id: 11, name: "Bắc Ninh", region: "RED_RIVER_DELTA" },
  { id: 12, name: "Hưng Yên", region: "RED_RIVER_DELTA" },
  { id: 13, name: "Ninh Bình", region: "RED_RIVER_DELTA" },
  { id: 14, name: "Quảng Trị", region: "NORTH_CENTRAL" },
  { id: 15, name: "Quảng Ngãi", region: "SOUTH_CENTRAL" },
  { id: 16, name: "Gia Lai", region: "CENTRAL_HIGHLANDS" },
  { id: 17, name: "Khánh Hòa", region: "SOUTH_CENTRAL" },
  { id: 18, name: "Lâm Đồng", region: "CENTRAL_HIGHLANDS" },
  { id: 19, name: "Đắk Lắk", region: "CENTRAL_HIGHLANDS" },
  { id: 20, name: "Đồng Nai", region: "SOUTHEAST" },
  { id: 21, name: "Tây Ninh", region: "SOUTHEAST" },
  { id: 22, name: "Vĩnh Long", region: "MEKONG_DELTA" },
  { id: 23, name: "Đồng Tháp", region: "MEKONG_DELTA" },
  { id: 24, name: "Cà Mau", region: "MEKONG_DELTA" },
  { id: 25, name: "An Giang", region: "MEKONG_DELTA" },
  // Remaining Units (Unchanged)
  { id: 26, name: "Quảng Ninh", region: "NORTHERN_HIGHLANDS" },
  { id: 27, name: "Lạng Sơn", region: "NORTHERN_HIGHLANDS" },
  { id: 28, name: "Điện Biên", region: "NORTHERN_HIGHLANDS" },
  { id: 29, name: "Sơn La", region: "NORTHERN_HIGHLANDS" },
  { id: 30, name: "Thanh Hóa", region: "NORTH_CENTRAL" },
  { id: 31, name: "Nghệ An", region: "NORTH_CENTRAL" },
  { id: 32, name: "Hà Tĩnh", region: "NORTH_CENTRAL" },
  { id: 33, name: "Bình Phước", region: "SOUTHEAST" },
  { id: 34, name: "Hậu Giang", region: "MEKONG_DELTA" },
];
