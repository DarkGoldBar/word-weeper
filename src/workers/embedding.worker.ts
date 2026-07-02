/// <reference lib="webworker" />
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

let extractor: FeatureExtractionPipeline | null = null
let boardVectors: number[][] = []
let calibrations: Array<{ mean: number; standardDeviation: number }> = []

const CALIBRATED_MEAN = 0.5
const CALIBRATED_STANDARD_DEVIATION = 0.15
const MIN_STANDARD_DEVIATION = 1e-6

env.allowLocalModels = false
env.useBrowserCache = true

function normalize(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / magnitude)
}

async function embed(texts: string[]) {
  if (!extractor) throw new Error('模型尚未初始化')
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  const dimensions = output.dims
  const width = dimensions[dimensions.length - 1]
  const data = Array.from(output.data as Float32Array)
  return texts.map((_, index) => normalize(data.slice(index * width, (index + 1) * width)))
}

function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0)
}

function calculateCalibration(referenceVectors: number[][]) {
  return boardVectors.map((boardVector) => {
    const similarities = referenceVectors.map((referenceVector) => cosineSimilarity(boardVector, referenceVector))
    const mean = similarities.reduce((sum, value) => sum + value, 0) / similarities.length
    const variance =
      similarities.reduce((sum, value) => sum + (value - mean) ** 2, 0) / similarities.length
    return {
      mean,
      standardDeviation: Math.max(Math.sqrt(variance), MIN_STANDARD_DEVIATION),
    }
  })
}

function calibrateSimilarity(similarity: number, index: number) {
  const calibration = calibrations[index]
  if (!calibration) return similarity
  const zScore = (similarity - calibration.mean) / calibration.standardDeviation
  return Math.min(1, Math.max(0, CALIBRATED_MEAN + zScore * CALIBRATED_STANDARD_DEVIATION))
}

async function initialize(words: string[], calibrationWords: string[]) {
  const hasWebGPU = 'gpu' in navigator
  let backend = 'WASM'
  if (hasWebGPU) {
    try {
      extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', {
        device: 'webgpu',
        dtype: 'q8',
      })
      backend = 'WebGPU'
    } catch {
      extractor = null
    }
  }
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', {
      device: 'wasm',
      dtype: 'q8',
    })
  }
  boardVectors = await embed(words)
  self.postMessage({ type: 'calibrating', backend })
  const referenceVectors = await embed(calibrationWords)
  calibrations = calculateCalibration(referenceVectors)
  self.postMessage({ type: 'ready', backend })
}

self.onmessage = async (
  event: MessageEvent<{ type: string; words?: string[]; calibrationWords?: string[]; input?: string }>,
) => {
  try {
    if (event.data.type === 'init') await initialize(event.data.words ?? [], event.data.calibrationWords ?? [])
    if (event.data.type === 'guess' && event.data.input) {
      const [guessVector] = await embed([event.data.input])
      const similarities = boardVectors.map((vector, index) =>
        calibrateSimilarity(cosineSimilarity(vector, guessVector), index),
      )
      self.postMessage({ type: 'result', similarities })
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : '模型加载失败' })
  }
}

export {}
