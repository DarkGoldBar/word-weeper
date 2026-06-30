# 扫词

本地双人语义猜词游戏。红蓝双方轮流输入词语，浏览器端模型会从棋盘的 15 个词中找出语义最接近的一项；先找出己方全部 5 个目标词的一方获胜。

## 运行

```bash
npm install
npm run dev
```

首次打开需要下载多语言 embedding 模型，之后由浏览器缓存。模型推理在 Web Worker 中执行，优先使用 WebGPU，不可用时回退至 WASM。游戏状态保存在 `localStorage`。

## 构建

```bash
npm run build
```
