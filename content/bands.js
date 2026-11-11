/* 年龄分档 · 4 档，adult 走独立关卡表
   6-12 岁合并档带 tiers：同一档内按「基础 / 多想一步」两层抽题（见 content/bank-*.js 的 tier）。
   旧档里的 a9 由 js/core.js 的 BAND_REMAP 映射到 a6，进度不丢。
   纯数据，不含逻辑。加载顺序见 index.html。 */
window.MI = window.MI || {};
MI.bands = [
  {
    "id": "a3",
    "name": "3-6 岁",
    "tag": "看图玩",
    "scale": 1.18,
    "rest": 2,
    "speak": true,
    "adult": true,
    "desc": "题目短、选项少、字更大。可以点小喇叭听题目和选项，建议大人陪着指一指。",
    "len": "一次 3～4 站，约 8 分钟",
    "track": "kid",
    "shells": true
  },
  {
    "id": "a6",
    "name": "6-12 岁",
    "tag": "读短句 · 也能多想一步",
    "scale": 1.06,
    "rest": 3,
    "speak": true,
    "adult": false,
    "tiers": true,
    "desc": "生活里的小故事，三选一为主。先玩基础题；这一站走过一次后，可以自己切到「多想一步」：线索更多、链条更长，练「想法不等于事实」和不同人的视角。随时能切回来。",
    "len": "一次 4～8 站，约 10～12 分钟",
    "track": "kid",
    "shells": true
  },
  {
    "id": "all",
    "name": "亲子 · 全年龄",
    "tag": "一起聊",
    "scale": 1,
    "rest": 3,
    "speak": false,
    "adult": true,
    "desc": "情境覆盖家里、学校和工作，每一站都留一句给大人的话，终章有一起聊的卡片。",
    "len": "不限时长，随时可以停",
    "track": "kid",
    "shells": true
  },
  {
    "id": "adult",
    "name": "成年 · 心智整理",
    "tag": "慢下来",
    "scale": 1,
    "rest": 3,
    "speak": false,
    "adult": false,
    "mindful": true,
    "desc": "面向成年人的轻量练习：识别自动思维、把观察和推测分开、给念头留一点距离，另有不打卡的静修间。",
    "len": "一次 1～3 站，或只做一次静修练习",
    "track": "adult",
    "shells": false
  }
];
