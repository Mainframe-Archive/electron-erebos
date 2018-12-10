'use strict'

import * as path from 'path'
import * as mime from 'mime'
import { format as formatUrl } from 'url'
import { SwarmClient } from '@erebos/swarm-node'
import { app, BrowserWindow, protocol } from 'electron'
import { answerRenderer } from 'electron-better-ipc'
import { promisify } from 'util'
import { Transform, pipeline } from 'stream'
import { createReadStream, createWriteStream } from 'fs'
const crypto = require('crypto')

const asyncPipeline = promisify(pipeline)
const INITIALIZATION_VECTOR_SIZE = 16

const isDevelopment = process.env.NODE_ENV !== 'production'
let manifestHash

class PrependInitializationVector extends Transform {
  constructor(iv) {
    super()
    this._added = false
    this._iv = iv
  }

  _transform(chunk, encoding, callback) {
    if (!this._added) {
      this._added = true
      this.push(this._iv)
    }
    this.push(chunk)
    callback()
  }
}

class Decrypt extends Transform {
  constructor(cipherKey) {
    super()
    this.cipherKey = cipherKey
  }

  _transform(chunk, encoding, callback) {
    if (!this._decode) {
      const iv = chunk.slice(0, INITIALIZATION_VECTOR_SIZE)

      this._decode = crypto.createDecipheriv('aes256', this.cipherKey, iv)
      this._decode.on('data', c => {
        this.push(c)
      })
      this._decode.on('end', () => {
        this.emit('end')
      })

      this._decode.write(chunk.slice(INITIALIZATION_VECTOR_SIZE, chunk.length))
    } else {
      this._decode.write(chunk)
    }
    callback()
  }
}

// Hardcoded for demo only - should be kept track of
const password = 'password'

const getCipherKey = (password) => {
  return crypto.createHash('sha256').update(password).digest()
}
const cipherKey = getCipherKey(password)

const swarm = new SwarmClient({ bzz: 'http://localhost:8500' })

answerRenderer('upload-file', async params => {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes256', cipherKey, iv)
    const options = {
      contentType: params.type,
      path: params.distPath,
    }
    const body = createReadStream(params.localPath).pipe(cipher).pipe(new PrependInitializationVector(iv))
    manifestHash = await swarm.bzz._upload(body, {}, {'content-type': params.type})
    return `app-file://${params.distPath}`
  } catch (error) {
    return {
      error: error.message
    }
  }
})

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow

function createMainWindow() {
  const window = new BrowserWindow()

  if (isDevelopment) {
    window.webContents.openDevTools()
  }

  if (isDevelopment) {
    window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
    // window.loadURL('app://files/index.html')
  } else {
    window.loadURL(
      formatUrl({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true,
      }),
    )
  }

  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.on('devtools-opened', () => {
    window.focus()
    setImmediate(() => {
      window.focus()
    })
  })

  return window
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow()
  }
})

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  protocol.registerStreamProtocol(
    'app-file',
    async (request, callback) => {
      // URL starts with `app-file://`
      const filePath = request.url.slice(11)

      if (filePath.length === 0) {
        callback({
          mimeType: 'text/html',
          data: Buffer.from('<h5>Not found</h5>'),
        })
      } else {
        const contentType = mime.getType(filePath)
        const res = await swarm.bzz._download(`${manifestHash}/${filePath}`, 'default')
        const data = res.body.pipe(new Decrypt(cipherKey))
        callback({
          headers: {
            'content-type': contentType
          },
          data: data
        })
      }
    },
    error => {
      if (error) console.error('Failed to register protocol')
    },
  )

  mainWindow = createMainWindow()
})
