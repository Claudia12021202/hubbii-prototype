# Hubbii 趣圈｜新版 Prototype（可用性測試版）

可以直接在瀏覽器點的原型。打開 `index.html` 是總覽頁，每張畫面都能點、能切換分頁、能篩選。

示範帳號「陳立安」同時有三種身分：參加「AI 字幕與配樂入門週」、受邀分享「手機短片剪輯 3 日練習」、主辦「從素材到短片」和「AI 影片新手交流週」。原型裡的今天是 **12/9（三）**。

## 測試入口

| 腳本 | 起點 | 主要經過 |
| --- | --- | --- |
| 1｜同一帳號兩種身分 | `T01_SharerList.html` 或 `N01_Notices.html` | 分享邀請 → 接受／婉拒 → 分享工作區；我主辦的 → 招募中活動 → 審核報名 |
| 2｜從探索到報名、兩天後看結果 | `E01_Explore.html` | 搜尋與篩選 → 初階 AI 影片交流 → 報名 → 報名狀態 → 我參加的 |

## 受測任務便條紙

每一頁左下角都有黃色便條紙，寫著受測者的任務。
- 受測者可以切換「任務 A／任務 B」、收起或移到右邊。
- 最下面「主持人：1／2」切換兩套腳本。
- 換頁時會記住目前的題目和收起狀態（存在瀏覽器裡）。要重來的話，在任一頁按 1 或 2 就會回到任務 A。

## 畫面清單

| 檔案 | 畫面 |
| --- | --- |
| `index.html` | 總覽與 Sitemap |
| `E01_Explore.html` | 探索活動（首頁＋搜尋篩選結果） |
| `E02_Detail.html` | 活動詳情：初階 AI 影片交流 |
| `E03_Form.html` | 報名頁 |
| `E04_Status.html` | 報名狀態（待審核） |
| `N01_Notices.html` | 通知 |
| `M01_Member.html`、`M01_Works.html` | 會員中心、我的作品 |
| `S01_LearnerList.html`、`S02_Space.html` | 我參加的活動、活動空間 |
| `T01_SharerList.html`、`T02_Invite.html` | 我分享的活動、分享邀請 |
| `T03_Workspace.html`、`T04_Live.html` | 分享工作區（準備中／進行中） |
| `H01_HostList.html`、`H02_Create.html` | 我主辦的活動、建立活動 |
| `H03_Manage.html`、`H04_Recruit.html` | 活動管理（進行中／招募中） |

## 檔案結構

- `*.html`：每張畫面一個檔案
- `wf.css`：共用樣式
- `components.js`：所有畫面與元件的內容和互動（由轉檔程式產生）
- `dc-lite.js`：讓畫面在一般瀏覽器執行的小型執行環境
- `tools/`：轉檔程式與原型原始檔。在設計畫布改完後，把新的 `.dc.html` 放進 `tools/src/`，在這個資料夾執行
  `python3 tools/convert.py tools/src . tools/dc-lite.js` 就能重新產生網頁（只會覆蓋網頁檔，不會刪其他檔案）。
