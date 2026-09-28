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

เปิดเว็บที่ `http://localhost:8200/poi/` และหยุด container ด้วย `docker compose down`

## Deploy บน Static Server

- หาก upload ทั้ง repository ไว้ในโฟลเดอร์ `poi` ให้เปิด `https://geodev.fun/poi/`; `index.html` ที่ root จะพาไปยัง `dist/` โดยอัตโนมัติ
- หาก server ตั้ง document root ไปที่ `dist/` โดยตรง ให้เปิด `https://geodev.fun/poi/` หลังวางไฟล์ทั้งหมดจาก `dist/` ไว้ในโฟลเดอร์ `poi`
- ต้อง upload เนื้อหาใน `dist/` ไปยัง server ด้วย การ push ขึ้น GitHub อย่างเดียวไม่ได้ deploy ไฟล์ไปที่ `geodev.fun`
- ไม่ต้อง upload `dist/config.js`; หน้าส่วนอื่นยังทำงานได้ แต่หน้าเปรียบเทียบ Google Maps ต้องสร้าง config บน server พร้อม API key ที่จำกัด referrer ให้เหมาะสม

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
