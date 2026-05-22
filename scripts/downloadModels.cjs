const path = require('path')
const fs = require('fs')

require('dotenv').config()

const PUBLIC_MODELS_DIR = path.join(__dirname, '..', 'public', 'models')

if (!fs.existsSync(PUBLIC_MODELS_DIR)) {
  fs.mkdirSync(PUBLIC_MODELS_DIR, { recursive: true })
  console.log('Created:', PUBLIC_MODELS_DIR)
}

async function main() {
  const { env, pipeline } = await import('@xenova/transformers')

  env.cacheDir = PUBLIC_MODELS_DIR
  env.localModelPath = PUBLIC_MODELS_DIR
  env.allowRemoteModels = true
  env.allowLocalModels = true
  env.hfToken = process.env.HF_TOKEN

  console.log('\n Downloading models to:', PUBLIC_MODELS_DIR)
  console.log('This runs once — models work fully offline after.\n')

 const models = [
  {
    task: 'token-classification',
    model: 'Xenova/bert-base-NER',
    label: 'BERT NER — entity extraction'
  },
  {
    task: 'zero-shot-classification',
    model: 'Xenova/nli-deberta-v3-small',
    label: 'DeBERTa — document classifier'
  }
]

  for (const { task, model, label } of models) {
    console.log(`⬇ ${label}`)
    console.log(`   Model: ${model}`)

    try {
      await pipeline(task, model, {
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            const pct = progress.progress != null ? progress.progress.toFixed(1) + '%' : '...'
            process.stdout.write(`\r   ${progress.file ?? ''} — ${pct}        `)
          }

          if (progress.status === 'done') {
            process.stdout.write(`\r   ${progress.file ?? 'file'} done          \n`)
          }
        }
      })

    console.log(` ${label} ready\n`)
    } 
    catch (err) 
    {
      console.error(`\n Failed: ${label}`)
      console.error('   Error:', err.message)
      continue
    }
  }

  console.log('━'.repeat(50))
  console.log(' All models saved to /public/models/')
  console.log(' App will work fully offline on mobile.\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
