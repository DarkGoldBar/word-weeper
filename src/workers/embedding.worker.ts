/// <reference lib="webworker" />
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

let extractor: FeatureExtractionPipeline | null = null
let boardVectors: number[][] = []

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

async function initialize(words: string[]) {
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
  self.postMessage({ type: 'ready', backend })
}

self.onmessage = async (event: MessageEvent<{ type: string; words?: string[]; input?: string }>) => {
  try {
    if (event.data.type === 'init') await initialize(event.data.words ?? [])
    if (event.data.type === 'guess' && event.data.input) {
      const [guessVector] = await embed([event.data.input])
      const similarities = boardVectors.map((vector) =>
        vector.reduce((sum, value, index) => sum + value * guessVector[index], 0),
      )
      self.postMessage({ type: 'result', similarities })
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : '模型加载失败' })
  }
}

export {}
