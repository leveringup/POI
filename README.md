# nimman-poi-research-map

เว็บแผนที่ localhost สำหรับงานวิจัย POI จาก Street View

## เปิดเว็บ

เปิด Terminal ในโฟลเดอร์นี้ แล้วรัน:

```powershell
python -m http.server 8000 --directory dist
```

จากนั้นเปิด `http://localhost:8000`

## เปิดด้วย Docker Compose

```powershell
docker compose up -d
```

เปิดเว็บที่ `http://localhost:8200/poi/` และหยุด container ด้วย `docker compose down` คอนเทนเนอร์จะ bind ที่ `127.0.0.1:8200` เพื่อให้ Nginx บนเครื่องเดียวกัน proxy เข้ามาได้

## Deploy บน geodev.fun

บน Ubuntu server ที่ Nginx และ Docker ติดตั้งอยู่ ให้ clone หรือ pull repository แล้วรัน:

```bash
docker compose up -d
```

เพิ่มเนื้อหาใน `deploy/geodev-poi-location.conf` ภายใน HTTPS `server` block ของ `geodev.fun` แล้วตรวจและ reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

ตัวอย่างนี้ proxy `/poi/` ไปยัง container ที่ `127.0.0.1:8200` โดยคง path ไว้ การ push ขึ้น GitHub อย่างเดียวไม่ deploy ไฟล์หรือเริ่ม container บน server

ไม่ต้อง commit หรือ upload `dist/config.js`; หากต้องการ Google Maps บน server ให้สร้างไฟล์นี้บน server และจำกัด API key ด้วย HTTP referrer ของเว็บจริง

## ข้อมูลที่เชื่อมแล้ว

- `dist/data/sv_poi_shifted.geojson` — POI Street View ทั้งเทศบาลหลังเลื่อนตำแหน่ง
- `dist/data/sv_poi_clip_10m.geojson` — POI Street View ภายใน buffer 10 เมตร
- `dist/data/osm_poi_clip_10m.geojson` — OSM ภายใน buffer 10 เมตร
- `dist/data/gg_poi_clip_10m.geojson` — Google Places ภายใน buffer 10 เมตร
- `dist/data/buffer_10m.geojson` — ขอบเขต buffer 10 เมตร
- `dist/data/road_nimman.geojson` — แนวถนนนิมมาน

## ก่อนใช้หน้าการเปรียบเทียบ Google

ใส่ Google Maps JavaScript API key ที่จำกัดการใช้งานเฉพาะ `http://localhost:*` ใน `dist/config.js` และเปิด Maps JavaScript API ใน Google Cloud

## รูปป้ายใน Popup

เพิ่มฟิลด์ `crop_urls` ลงใน `sv_poi_shifted.geojson` เป็นรายการ URL สัมพัทธ์ เช่น `assets/crops/258_left_01.jpg` แล้ววางรูปไว้ใน `dist/assets/crops/`
