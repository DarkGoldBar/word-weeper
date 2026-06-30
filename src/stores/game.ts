import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { WORDS } from '../data/words'
import type { Capsule, GuessRecord, PersistedGame, Player } from '../types'

const STORAGE_KEY = 'word-sweeper-game-v1'

function shuffled<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function makeBoard(): Capsule[] {
  return shuffled(WORDS)
    .slice(0, 15)
    .map((entry, index) => ({
      id: entry.id,
      word: entry.word,
      team: index < 5 ? 'red' : index < 10 ? 'neutral' : 'blue',
      revealed: index >= 5 && index < 10,
    }))
}

function loadGame(): PersistedGame | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as PersistedGame | null
    if (!value || value.board?.length !== 15 || !Array.isArray(value.guesses)) return null
    return value
  } catch {
    return null
  }
}

export const useGameStore = defineStore('game', () => {
  const saved = loadGame()
  const board = ref<Capsule[]>(saved?.board ?? makeBoard())
  const currentPlayer = ref<Player>(saved?.currentPlayer ?? 'red')
  const guesses = ref<GuessRecord[]>(saved?.guesses ?? [])
  const winner = ref<Player | null>(saved?.winner ?? null)

  const redRevealed = computed(() => board.value.filter((c) => c.team === 'red' && c.revealed).length)
  const blueRevealed = computed(() => board.value.filter((c) => c.team === 'blue' && c.revealed).length)

  function recordGuess(input: string, similarities: number[], hitIndex: number) {
    if (winner.value) return
    const player = currentPlayer.value
    const hit = board.value[hitIndex]
    if (hit.team !== 'neutral') hit.revealed = true
    guesses.value.push({
      id: crypto.randomUUID(),
      player,
      input,
      similarities,
      hitIndex,
      createdAt: Date.now(),
    })
    if (redRevealed.value === 5) winner.value = 'red'
    else if (blueRevealed.value === 5) winner.value = 'blue'
    else currentPlayer.value = player === 'red' ? 'blue' : 'red'
  }

  function restart() {
    board.value = makeBoard()
    currentPlayer.value = 'red'
    guesses.value = []
    winner.value = null
  }

  watch(
    [board, currentPlayer, guesses, winner],
    () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          board: board.value,
          currentPlayer: currentPlayer.value,
          guesses: guesses.value,
          winner: winner.value,
        }),
      )
    },
    { deep: true, immediate: true },
  )

  return { board, currentPlayer, guesses, winner, redRevealed, blueRevealed, recordGuess, restart }
})
