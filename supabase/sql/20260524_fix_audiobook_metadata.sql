UPDATE public.audiobook_metadata
SET
  author = 'Nguyên Phong',
  author_en = 'Nguyên Phong',
  author_vi = 'Nguyên Phong',
  cover_url = 'https://product.hstatic.net/200000654445/product/duong-may-qua-xu-tuyet_95960ec983744b6180adfc61092ea89f.jpg',
  description = 'Bản phóng tác tiếng Việt của Nguyên Phong từ The Way of the White Clouds, ghi lại hành trình tâm linh và văn hóa Tây Tạng của Anagarika Govinda.',
  description_vi = 'Bản phóng tác tiếng Việt của Nguyên Phong từ The Way of the White Clouds, ghi lại hành trình tâm linh và văn hóa Tây Tạng của Anagarika Govinda.',
  description_en = 'Vietnamese adaptation by Nguyên Phong from The Way of the White Clouds, documenting Anagarika Govinda’s spiritual journey through Tibetan culture.',
  updated_at = now()
WHERE title = 'Đường Mây Qua Xứ Tuyết';

UPDATE public.audiobook_metadata
SET
  author = 'Thích Nhất Hạnh',
  author_en = 'Thích Nhất Hạnh',
  author_vi = 'Thích Nhất Hạnh',
  cover_url = 'https://www.netabooks.vn/Data/Sites/1/Product/38503/thien-su-va-em-be-5-tuoi.jpg',
  description = 'Phương pháp trị liệu khổ đau từ thời thơ ấu của Thiền sư Thích Nhất Hạnh, hướng người đọc trở về chăm sóc em bé bên trong bằng chánh niệm.',
  description_vi = 'Phương pháp trị liệu khổ đau từ thời thơ ấu của Thiền sư Thích Nhất Hạnh, hướng người đọc trở về chăm sóc em bé bên trong bằng chánh niệm.',
  description_en = 'Thích Nhất Hạnh’s mindfulness guidance for healing childhood suffering and caring for the inner child.',
  updated_at = now()
WHERE title = 'Thiền Sư Và Em Bé 5 Tuổi';
