# Level 01 Candy Meadow: persiapan aset premium

Status: **sistemnya sudah siap, tapi aset premiumnya belum ada.** Level 01 masih memakai art placeholder prosedural (bentuk geometris). Setiap file premium yang belum dipasang otomatis tetap memakai placeholder-nya, jadi aset bisa dipasang sedikit demi sedikit.

Concept sheet tidak dipakai sebagai gambar di dalam game. Gambar dari internet juga tidak dipakai.

## 1. Hasil audit renderer

| Bagian | Kondisi saat ini |
| --- | --- |
| Engine | Phaser 3.90, WebGL, physics Arcade. Skala `RESIZE` mengikuti ukuran layar dalam CSS px. |
| Kamera | Zoom = tinggi layar / 360. Di iPhone landscape (tinggi 390) sekitar 1,1x; di desktop 720p sekitar 2x. |
| Art | Semua art prosedural (Phaser Graphics lalu `generateTexture`), dibuat sekali lalu di-cache di TextureManager. |
| Loader | Sebelumnya tidak ada loader gambar. Folder `public/assets` ada tapi kosong. |
| Platform | Visual dan collision sudah terpisah. Visual berupa `Image`, collision berupa `Zone` statis. Collision tidak pernah membaca ukuran gambar. |
| Background | Scene sendiri (`BackgroundScene`) di belakang game, tidak ikut zoom kamera. Layer berupa TileSprite yang bergeser mengikuti kamera. |
| Hazard | Duri berupa TileSprite. Checkpoint dan portal berupa Image dengan tween scale. |

Temuan penting untuk kualitas premium: canvas game di-render pada resolusi CSS px. Di iPhone (layar 3x), browser yang memperbesar gambarnya, jadi aset premium akan terlihat agak lembut di HP. Menaikkan resolusi render memengaruhi performa dan layout HUD, jadi itu langkah terpisah yang perlu persetujuan dulu.

## 2. Yang sudah disiapkan di kode

| Fitur | File |
| --- | --- |
| Manifest aset (25 file, ukuran, transparansi, fungsi, cara pasang) | `src/art/premium/candyMeadowAssets.json` |
| Loader lokal: `pack.json` dibaca saat boot (maksimal 1,5 detik, tidak pernah error). Gambar dimuat hanya saat Level 01 dibuka, dan file yang gagal dimuat tetap memakai placeholder. | `src/art/premium/premiumAssets.ts` |
| Konfigurasi parallax per layer (`CANDY_MEADOW_PARALLAX`: kecepatan, anchor, offset, drift, alpha) | `src/art/premium/premiumAssets.ts` |
| Platform dari tileset 9-slice dan 3-slice. Ujung digambar sekali dan bagian tengah diulang, jadi platform tidak pernah ditarik (stretch). Hasilnya di-cache per ukuran. | `src/art/premium/premiumPlatforms.ts` |
| Pemilihan art platform terpisah dari collision (`platformArt`) | `src/art/textures.ts`, `LevelBuilder.ts`, `FakePlatform.ts` |
| Layer 5 di depan gameplay, hanya aktif jika `fg_flowers` dipasang | `src/scenes/ForegroundScene.ts` |
| Background memakai layer premium satu per satu bila tersedia | `src/scenes/BackgroundScene.ts` |
| Prop premium (skala otomatis 1/2) | `src/levels/decor.ts` |
| Duri, bendera dan portal premium diperkecil ke ukuran placeholder, sehingga hit area dan tween tidak berubah | `bakePremiumHazards` |
| Pemeriksa aset: cek ukuran dan transparansi, lalu tulis `pack.json` | `scripts/asset-pack.mjs` (`npm run assets:pack`) |

Yang tidak berubah: gameplay, collision, physics, hitbox, Mochi 2.0, dan Level 02–04. Level 02–04 dan menu tidak pernah memuat aset premium.

## 3. Struktur folder

```
public/assets/candy-meadow/
  pack.json          ← dibuat oleh npm run assets:pack (sekarang kosong)
  bg/                ← layer background 1–4
  fg/                ← layer 5 (depan pemain)
  tiles/             ← tileset platform + retakan lantai palsu
  props/             ← pohon, bunga, pagar, papan, permen melayang
  hazards/           ← duri, bendera checkpoint, portal
```

## 4. Daftar aset yang dibutuhkan

Semua ukuran adalah **2x ukuran di layar** (1 tile game = 32 px = 64 px di file). Format yang diterima PNG atau WebP. Namanya harus persis seperti di tabel; ekstensi `.png` atau `.webp` sama-sama bisa.

### Background dan foreground (strip harus seamless kiri-kanan)

| File | Ukuran (px) | Transparan | Fungsi | Cara pasang |
| --- | --- | --- | --- | --- |
| `bg/bg_sky` | 1024×540 | tidak | Layer 1: gradasi langit pastel, tanpa awan atau objek | Menutupi layar (cover), diam |
| `bg/bg_clouds` | 2048×480 | ya | Awan, pelangi, pulau melayang, balon jauh | Menempel di atas layar, parallax 0,03 + drift pelan |
| `bg/bg_castle` | 2048×600 | ya | Layer 2: istana jauh dan bukit berkabut | Dasar menempel ke bawah layar, parallax 0,07 |
| `bg/bg_mountains` | 2048×520 | ya | Layer 3: gunung permen berlapis icing dan air terjun | Dasar menempel ke bawah layar, parallax 0,16 |
| `bg/bg_trees` | 2048×440 | ya | Layer 4: pohon lollipop, cotton candy, semak | Dasar menempel ke bawah layar, parallax 0,32 |
| `fg/fg_flowers` | 2048×160 | ya | Layer 5: bunga dan rumput di depan pemain | Bawah layar, parallax 1,15. Gambar hanya di 40% bawah dan jarang-jarang, supaya duri, platform dan Mochi tidak tertutup |

### Tileset platform

| File | Ukuran (px) | Transparan | Fungsi | Cara pasang |
| --- | --- | --- | --- | --- |
| `tiles/tiles_ground` | 192×224 | ya | 9-slice tanah dan platform tebal (kue berlapis frosting) | Grid 3 kolom × 64 px: ujung kiri, tengah (diulang), ujung kanan. Baris atas 96 px (32 px frosting di atas permukaan + 64 px badan), baris tengah 64 px (diulang ke bawah), baris bawah 64 px. Garis permukaan tepat di y = 32 |
| `tiles/tiles_ledge` | 192×96 | ya | 3-slice pijakan tipis setinggi 1 tile (wafer) | 3 sel 64×96: kiri, tengah (diulang), kanan. Permukaan di y = 32 |
| `tiles/tiles_crack` | 128×48 | ya | Retakan halus untuk lantai palsu | Ditimpa di tengah permukaan. Harus halus, jangan mencolok |

Tekstur tengah harus nyambung saat diulang (kiri-kanan, dan atas-bawah untuk baris tengah).

### Hazard

| File | Ukuran (px) | Transparan | Fungsi | Cara pasang |
| --- | --- | --- | --- | --- |
| `hazards/hz_spike` | 64×48 | ya | Duri permen, satu tile, kontras dengan frosting pink | Diulang sepanjang deretan duri; dasar duri = bawah gambar |
| `hazards/hz_flag_off` | 96×144 | ya | Checkpoint belum aktif | Tiang di x = 25 px, dasar tiang di bawah gambar |
| `hazards/hz_flag_on` | 96×144 | ya | Checkpoint aktif | Posisi tiang sama persis dengan versi off |
| `hazards/hz_portal` | 144×144 | ya | Portal finish swirl permen | Tengah gambar = tengah portal; putaran dibuat oleh game |

### Props (dasar di tengah bawah gambar, kecuali yang melayang)

| File | Ukuran (px) | Fungsi |
| --- | --- | --- |
| `props/prop_lolliTree` | 128×264 | Pohon lollipop |
| `props/prop_cottonTree` | 200×256 | Pohon cotton candy |
| `props/prop_flowers` | 144×60 | Rumpun bunga permen |
| `props/prop_fence` | 208×80 | Pagar biskuit |
| `props/prop_sign` | 112×128 | Papan panah, tanpa tulisan |
| `props/prop_bush` | 152×88 | Semak permen |
| `props/prop_candyCane` | 60×152 | Tongkat candy cane |
| `props/prop_cupcake` | 88×92 | Cupcake dekorasi |
| `props/prop_balloon` | 88×152 | Balon melayang (titik tengah) |
| `props/prop_wrapped` | 60×36 | Permen bungkus melayang (titik tengah) |
| `props/prop_starCandy` | 44×44 | Permen bintang melayang (titik tengah) |
| `props/prop_gumdrop` | 40×36 | Gumdrop melayang (titik tengah) |

Semua props wajib transparan. Ukuran props boleh sedikit berbeda, karena game menampilkannya di setengah ukuran file.

### Aturan umum untuk artist

- Warna sRGB, background transparan (kecuali langit), tanpa bayangan jatuh di luar kanvas.
- Strip background: piksel paling kiri harus nyambung dengan paling kanan.
- Duri harus tetap terbaca di atas frosting pink. Lantai palsu hanya boleh beda sedikit (retakan halus).
- Tidak ada teks di dalam gambar.
- Perkiraan memori GPU: background + foreground sekitar 20 MB, platform yang sudah dirakit sekitar 7 MB, props dan hazard kurang dari 1 MB. Masih aman untuk iPhone.

## 5. Cara memasang asset pack

1. Salin file ke folder di atas dengan nama yang persis sama.
2. Jalankan `npm run assets:pack`. Script menampilkan file yang terpasang, file yang masih placeholder, dan peringatan ukuran atau transparansi. Tambahkan `--strict` agar gagal jika ada yang salah.
3. Jalankan `npm run dev` lalu buka Level 01.
4. Atur posisi layer di `CANDY_MEADOW_PARALLAX` jika perlu. Cukup ubah angka offset dan parallax; tidak ada kode lain yang perlu diubah.

## 6. Rencana integrasi (setelah asset pack diunggah)

1. **Cek pack**: jalankan `assets:pack --strict`, perbaiki nama atau ukuran file.
2. **Background 1–4**: pasang, lalu atur offset agar horizon dan tanah pas di iPhone landscape dan desktop.
3. **Tileset platform**: cek sambungan ujung dan tengah di semua ukuran platform Level 01 (10 ukuran). Pastikan lantai palsu hanya beda di retakannya.
4. **Props**: cek bahwa props tidak menutupi duri atau lubang (sudah dijaga oleh test jarak prop ke hazard).
5. **Hazard**: cek keterbacaan duri dan bendera.
6. **Foreground**: cek bahwa layer depan tidak menutupi Mochi, duri, atau tepi platform.
7. **Uji**: geometri collision identik, Level 01 bisa diselesaikan bot, Level 02–04 tidak berubah, FPS tidak turun, tidak ada error, plus checklist manual di iPhone.
8. **Prototype artifact**: file aset ikut dipublikasikan di samping halaman prototype, sehingga prototype di Claude bisa menampilkan art premium.

## 7. Keterbatasan

- Belum ada aset premium sama sekali. Yang sudah diuji hanya pack DEBUG buatan otomatis (kotak berlabel) untuk membuktikan loader, tiling dan fallback bekerja. Pack itu tidak disimpan di repo.
- Duri, bendera dan portal premium diperkecil ke ukuran placeholder (1x), jadi di desktop (zoom 2x) bisa sedikit kurang tajam dibanding background dan platform yang 2x.
- Tileset baru punya satu variasi per jenis (ground dan ledge). Variasi acak per tile bisa ditambah nanti jika aset menyediakannya.
- Level 01 tidak punya moving platform atau collapsing platform, jadi aset untuk itu tidak ada di daftar ini.
- Resolusi render di iPhone (lihat bagian 1) membatasi ketajaman aset premium di HP.
