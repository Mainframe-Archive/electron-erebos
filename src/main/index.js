'use strict'

import * as path from 'path'
import * as mime from 'mime'
import getStream from 'get-stream'
import { format as formatUrl } from 'url'
import { SwarmClient } from '@erebos/swarm-node'
import { app, BrowserWindow, protocol } from 'electron'
import { answerRenderer } from 'electron-better-ipc'
import { createReadStream } from 'fs'
import { createSecretStreamKey, createEncryptStream, createDecryptStream } from '@mainframe/utils-crypto'

let manifestHash
const isDevelopment = process.env.NODE_ENV !== 'production'
const streamKey = createSecretStreamKey()
const swarm = new SwarmClient({ bzz: 'http://localhost:8500' })

answerRenderer('upload-file', async params => {
  try {
    const body = createReadStream(params.localPath).pipe(createEncryptStream(streamKey))
    manifestHash = await swarm.bzz._upload(body, {}, {'content-type': params.type})
    return `app-file://${params.distPath}`
  } catch (error) {
    return {
      error: error.message
    }
  }
})

answerRenderer('set', async params => {
  try {
    const Readable = require('stream').Readable
    const dataStream = new Readable()
    dataStream.push(params.data)
    dataStream.push(null)
    const body = dataStream.pipe(createEncryptStream(streamKey))
    manifestHash = await swarm.bzz._upload(body, {}, {'content-type': 'text/plain'})
    return manifestHash
  } catch (error) {
    return error.message
  }
})

answerRenderer('get', async params => {
  try {
    const response = await swarm.bzz.download(params.manifestHash)
    const stream = response.body.pipe(createDecryptStream(streamKey))
    const data = await getStream(stream)
    return data
  } catch (error) {
    return error.message
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
        const data = res.body.pipe(createDecryptStream(streamKey))
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
