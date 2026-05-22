console.log('[Embedding Worker] Starting...')

let embeddingPipeline = null
let initPromise = null

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initializeWorker() {
  try {
    console.log('[Embedding Worker] Importing transformers...')
    const { pipeline, env } = await import('@xenova/transformers')

    // Use locally cached model — no remote fetch
    env.localModelPath    = '/models/'
    env.cacheDir          = '/models/'
    env.allowLocalModels  = true
    env.allowRemoteModels = true   // fallback if local missing

    postMessage({ type: 'progress', progress: 0.1, status: 'Loading embedding model...' })

    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        quantized: true,
        progress_callback: (p) => {
          if (p.status === 'downloading') {
            const scaled = 0.1 + ((p.progress ?? 0) / 100) * 0.8
            postMessage({ type: 'progress', progress: parseFloat(scaled.toFixed(2)),
              status: `Loading embedding model... ${p.progress?.toFixed(0) ?? ''}%` })
          } else if (p.status === 'loading') {
            postMessage({ type: 'progress', progress: 0.9, status: 'Preparing embedding model...' })
          }
        }
      }
    )

    postMessage({ type: 'progress', progress: 1, status: 'Embedding model ready', stage: 'ready' })
    console.log('[Embedding Worker] MiniLM ready')

  } catch (err) {
    console.error('[Embedding Worker] Init failed:', err)
    postMessage({ type: 'error', error: 'Failed to load embedding model: ' + String(err) })
    throw err
  }
}

initPromise = initializeWorker()

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e) => {
  const { text, id } = e.data

  if (!text?.trim()) {
    postMessage({ type: 'error', id, error: 'No text provided' })
    return
  }

  try {
    await initPromise
  } catch {
    postMessage({ type: 'error', id, error: 'Embedding worker failed to initialize' })
    return
  }

  if (!embeddingPipeline) {
    postMessage({ type: 'error', id, error: 'Pipeline not ready' })
    return
  }

  try {
    // Truncate to 256 tokens (MiniLM max is 512 but 256 is faster and covers most docs)
    const truncated = text.slice(0, 1500)

    // Run feature extraction — returns tensor [1, seq_len, 384]
    const output = await embeddingPipeline(truncated, {
      pooling: 'mean',
      normalize: true,   // L2-normalise → cosine similarity = dot product
    })

    // Extract flat array of 384 floats
    const embedding = Array.from(output.data)

    postMessage({ type: 'result', id, embedding })

  } catch (err) {
    console.error('[Embedding Worker] Embedding failed:', err)
    postMessage({ type: 'error', id, error: String(err) })
  }
}
