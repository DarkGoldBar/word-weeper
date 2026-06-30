export type CapsuleTeam = 'red' | 'neutral' | 'blue'
export type Player = 'red' | 'blue'

export interface WordEntry {
  id: string
  word: string
  category: string
}

export interface Capsule {
  id: string
  word: string
  team: CapsuleTeam
  revealed: boolean
}

export interface GuessRecord {
  id: string
  player: Player
  input: string
  similarities: number[]
  hitIndex: number
  createdAt: number
}

export interface PersistedGame {
  board: Capsule[]
  currentPlayer: Player
  guesses: GuessRecord[]
  winner: Player | null
}
