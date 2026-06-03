# Library App Context

Ung dung quan ly thu vien gom luong doc sach, sach noi, va quan tri tai khoan thanh vien/thu thu.

## Language

**Profile Lock**:
Trang thai khoa tai khoan trong `profiles.is_locked`, do admin hoac librarian dat de chan thao tac trong app.
_Avoid_: ban, auth ban

**Auth Ban**:
Trang thai cam dang nhap cua Supabase Auth, duoc bieu dien bang `auth.users.banned_until`.
_Avoid_: profile lock

**Account Lock Status**:
Trang thai tong hop cho UI, bi khoa neu co **Profile Lock** hoac **Auth Ban** con hieu luc.
_Avoid_: chi doc `profiles.is_locked`

**Book Cover**:
Anh bia hien thi cho sach vat ly hoac sach noi, uu tien metadata da luu truoc khi fallback sang nguon ben ngoai.
_Avoid_: thumbnail ngau nhien, placeholder

**Cover Enrichment**:
Qua trinh tu dong lay va chuan hoa **Book Cover** tu metadata khi them moi hoac cap nhat sach/sach noi.
_Avoid_: sync anh thu cong

**Imported R2 Audiobook**:
Sach noi da co record trong `audiobook_metadata` tro toi R2 object qua `source_id`, `source_url`, hoac tag `r2_path:<key>`. Import chi duoc xem la thanh cong khi record do doc lai duoc tu Supabase va hien thanh audiobook card trong danh sach he thong. UI R2 Explorer phai hien `Imported` va khong hien nut upload/import cho object/folder do.
_Avoid_: chi tin vao flag `isImported` tra ve tu R2 list

## Relationships

- Mot **Account Lock Status** gom toi da mot **Profile Lock** va mot **Auth Ban**.
- Mot **Auth Ban** co the ton tai ngay ca khi **Profile Lock** da tat.
- Mot **Book Cover** co the den tu metadata thu vien, Google Books, Open Library, hoac cache may.
- **Cover Enrichment** tao ra mot **Book Cover** uu tien metadata da luu, sau do moi den Google Books va Open Library.
- Mot **Imported R2 Audiobook** co the duoc import tu ca folder nhieu file; folder duoc xem la imported neu co child R2 key da duoc gan vao audiobook record.

## Example Dialogue

> **Dev:** "Tai khoan nay da mo khoa trong profile, sao Google login van bi chan?"
> **Domain expert:** "Vi do la **Auth Ban** con hieu luc; UI phai hien **Account Lock Status** tong hop va unlock phai go ca ban trong Supabase Auth."
>
> **Dev:** "Khi them sach moi, thu thu co phai bam dong bo anh bia khong?"
> **Domain expert:** "Khong — **Cover Enrichment** phai tu chay de tao **Book Cover** tot nhat co the."

## Flagged Ambiguities

- "ban" tung duoc dung cho ca **Profile Lock** va **Auth Ban**. Resolution: noi ro **Profile Lock** khi la DB profile, noi **Auth Ban** khi la Supabase Auth.
- "anh metadata" duoc chot la **Cover Enrichment**, khong phai thao tac sync thu cong cua UI.
