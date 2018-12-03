'use strict'

import * as path from 'path'
import { format as formatUrl } from 'url'
import { SwarmClient } from '@erebos/swarm-node'
import { app, BrowserWindow, protocol } from 'electron'
import { answerRenderer } from 'electron-better-ipc'

const isDevelopment = process.env.NODE_ENV !== 'production'

// Hardcoded for demo only - should be kept track of
let manifestHash =
  '19bbb8f61dac4c74e1ef7c20c9b439ab41446e23a3bc8de8f050c52b13c5ec81'

const swarm = new SwarmClient({ bzz: 'https://swarm-gateways.net' })

answerRenderer('upload-file', async params => {
  const options = {
    contentType: params.type,
    manifestHash,
    path: params.distPath,
  }
  console.log('upload file', params)
  manifestHash = await swarm.bzz.uploadFileFrom(params.localPath, options)
  return `app-file://${params.distPath}`
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
  protocol.registerBufferProtocol(
    'app-file',
    async (request, callback) => {
      // URL starts with `app-file://`
      const filePath = request.url.slice(11)
      console.log('request file', filePath)

      if (filePath.length === 0) {
        callback({
          mimeType: 'text/html',
          data: Buffer.from('<h5>Not found</h5>'),
        })
      } else {
        const res = await swarm.bzz.download(`${manifestHash}/${filePath}`)
        const data = await res.buffer()
        const contentType = res.headers.get('Content-Type').split('; charset=')
        callback({ data, mimeType: contentType[0], charset: contentType[1] })
      }
    },
    error => {
      if (error) console.error('Failed to register protocol')
    },
  )

  mainWindow = createMainWindow()
})
