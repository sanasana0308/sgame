# Sandywich 遊戲網站

Sandywich Yoga 的小遊戲。放在 Vercel，推上 GitHub 後約一分鐘自動更新。

| 網址 | 內容 |
|---|---|
| `/` | 首頁 |
| `/town` | 三明治鎮（每月一區） |
| `/town/book` | 貼紙簿 |
| `/cards/2026-10-shoulder` | 第一區序列圖卡 |
| `/mom` | 兩寶媽的一天 |
| `/pdpl` | 排都排了・單關版 |

- 規劃：`PLAN.md`
- Sandy 每月要給的內容：`CONTENT-FORMAT.md`
- 新的一區：在 `content/zones/` 加一份 json，再把 id 加進 `content/zones/index.json`。程式不用改。
- 玩家存檔：瀏覽器的 `sandywich.player`（見 `town/player.js`）。
