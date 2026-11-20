# 度 ↔ 公尺：經緯度換算工具

純前端靜態網站（無建置步驟、無外部相依），可直接用 GitHub Pages 發佈。

## 功能

1. **經緯度一度差多少公尺**：輸入緯度（與度數差），以 WGS84 橢球算出緯度向、經度向長度，附小數位數對照表、各緯度一覽、曲線圖，以及公尺 → 度的反算。
2. **十進位 vs 二進位展點差異**：貼上多個座標，轉成 float32 / float64 / 自訂位元數的二進位定點後，顯示位元內容、精確儲存值、位置誤差（公尺），並以畫布呈現「點被吸到格點上」與多點展點（誤差可放大）。誤差以 BigInt 對十進位字串做精確計算，float64 的 nm 級誤差也算得出來。
3. **座標轉換**：WGS84 ⇄ TWD97、WGS84 ⇄ TWD67、TWD97 ⇄ TWD67（TM2 二度分帶，中央經線 121° / 119°，可自動判斷），含批次轉換。

## 精度說明

- TM 投影使用 Krüger 級數（Karney 2011），與 pyproj（EPSG:3826 / 3825）比對差異 < 0.1 mm。
- WGS84 與 TWD97 經緯度視為相同。
- TWD97 ⇄ TWD67 採內政部公告六參數轉換式，屬區域性迴歸模型，精度約公尺等級；兩方向各自為官方式，來回約有 1–2 cm 殘差。

## 本機執行與測試

```bash
python3 -m http.server 8000   # 開啟 http://localhost:8000
node test/geo.test.js         # 數學核心測試
```

## 發佈到 GitHub Pages

Repo → Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 main（合併後）、資料夾 `/ (root)`。
