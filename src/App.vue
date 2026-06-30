<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from './stores/game'

const game = useGameStore()
const { board, currentPlayer, guesses, winner, redRevealed, blueRevealed } = storeToRefs(game)
const input = ref('')
const modelState = ref<'loading' | 'ready' | 'error'>('loading')
const backend = ref('')
const errorMessage = ref('')
const calculating = ref(false)
let pendingInput = ''
let worker: Worker

const statusText = computed(() => {
  if (winner.value) return `${winner.value === 'red' ? '红方' : '蓝方'}胜利`
  if (modelState.value === 'loading') return '正在加载语义模型'
  if (modelState.value === 'error') return '模型加载失败'
  return '对局进行中'
})

const canSubmit = computed(
  () => modelState.value === 'ready' && !calculating.value && !winner.value && input.value.trim().length > 0,
)

function initWorker() {
  worker?.terminate()
  modelState.value = 'loading'
  errorMessage.value = ''
  worker = new Worker(new URL('./workers/embedding.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ type: string; backend?: string; similarities?: number[]; message?: string }>) => {
    if (event.data.type === 'ready') {
      modelState.value = 'ready'
      backend.value = event.data.backend ?? ''
    } else if (event.data.type === 'result' && event.data.similarities) {
      const similarities = event.data.similarities
      const hitIndex = similarities.reduce((best, value, index) => (value > similarities[best] ? index : best), 0)
      game.recordGuess(pendingInput, similarities, hitIndex)
      pendingInput = ''
      calculating.value = false
    } else if (event.data.type === 'error') {
      modelState.value = 'error'
      errorMessage.value = event.data.message ?? '未知错误'
      calculating.value = false
    }
  }
  worker.onerror = () => {
    modelState.value = 'error'
    errorMessage.value = '工作线程启动失败，请刷新页面重试。'
    calculating.value = false
  }
  worker.postMessage({ type: 'init', words: board.value.map((capsule) => capsule.word) })
}

function submit() {
  const value = input.value.trim()
  if (!canSubmit.value || !value) return
  pendingInput = value
  input.value = ''
  calculating.value = true
  worker.postMessage({ type: 'guess', input: value })
}

function restart() {
  game.restart()
  pendingInput = ''
  input.value = ''
  calculating.value = false
  initWorker()
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

initWorker()
onBeforeUnmount(() => worker?.terminate())
</script>

<template>
  <main class="game-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">扫</span>
        <div><h1>扫词</h1><p>用语义，找到藏起来的词</p></div>
      </div>
      <button class="restart-button" type="button" @click="restart">重新开始</button>
    </header>

    <section class="status-panel" :class="{ finished: winner }" aria-live="polite">
      <div class="turn">
        <span class="eyebrow">当前状态</span>
        <strong>{{ statusText }}</strong>
        <small v-if="modelState === 'ready'">模型就绪 · {{ backend }}</small>
        <small v-else-if="errorMessage">{{ errorMessage }}</small>
        <small v-else>首次加载需要下载模型，请稍候</small>
      </div>
      <div class="score red-score"><span>红方</span><strong>{{ redRevealed }}<i>/5</i></strong></div>
      <div class="versus">VS</div>
      <div class="score blue-score"><span>蓝方</span><strong>{{ blueRevealed }}<i>/5</i></strong></div>
      <div v-if="!winner" class="player-chip" :class="currentPlayer">
        <span class="dot"></span>{{ currentPlayer === 'red' ? '红方' : '蓝方' }}回合
      </div>
    </section>

    <section class="board-section">
      <div class="section-heading"><div><span class="eyebrow">词语棋盘</span><h2>找到你方的五个目标词</h2></div><p>灰色词为中立词，所有词始终参与匹配</p></div>
      <div class="board">
        <button
          v-for="(capsule, index) in board"
          :key="capsule.id"
          type="button"
          class="capsule"
          :class="[capsule.team, { revealed: capsule.revealed }]"
          disabled
        >
          <span class="capsule-number">{{ index + 1 }}</span>
          <strong>{{ capsule.revealed ? capsule.word : '•••' }}</strong>
          <span class="capsule-label">{{ capsule.team === 'neutral' ? '中立' : capsule.revealed ? '已发现' : '待发现' }}</span>
        </button>
      </div>

      <form class="guess-form" @submit.prevent="submit">
        <div class="input-wrap">
          <label for="guess">输入一个词语或短语</label>
          <input id="guess" v-model="input" autocomplete="off" maxlength="40" placeholder="例如：夜晚、动物、温暖……" :disabled="!!winner" />
        </div>
        <button type="submit" :disabled="!canSubmit">{{ calculating ? '计算中…' : winner ? '对局已结束' : '提交猜测' }}</button>
      </form>
    </section>

    <section class="history-section">
      <div class="section-heading"><div><span class="eyebrow">猜测历史</span><h2>每一次语义匹配</h2></div><p>{{ guesses.length }} 次猜测</p></div>
      <div v-if="guesses.length" class="table-scroll">
        <table>
          <thead><tr><th>玩家</th><th>输入词</th><th v-for="(capsule, i) in board" :key="capsule.id" :class="capsule.team">{{ capsule.team === 'red' ? '红' : capsule.team === 'blue' ? '蓝' : '灰' }}{{ (i % 5) + 1 }}</th></tr></thead>
          <tbody>
            <tr v-for="record in [...guesses].reverse()" :key="record.id">
              <td><span class="mini-player" :class="record.player">{{ record.player === 'red' ? '红' : '蓝' }}</span></td>
              <td>{{ record.input }}</td>
              <td v-for="(value, i) in record.similarities" :key="i" :class="{ hit: i === record.hitIndex }"><strong v-if="i === record.hitIndex">{{ percent(value) }}</strong><template v-else>{{ percent(value) }}</template></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state"><span>↗</span><p>提交第一个词语后，完整的相似度结果会显示在这里。</p></div>
    </section>
  </main>
</template>
