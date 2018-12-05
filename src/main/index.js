'use strict'

import * as path from 'path'
import { format as formatUrl } from 'url'
import { SwarmClient } from '@erebos/swarm-node'
import { app, BrowserWindow, protocol } from 'electron'
import { answerRenderer } from 'electron-better-ipc'
const encrypt = require('./encrypt')
const decrypt = require('./decrypt')
const {PassThrough} = require('stream')
const fs = require('fs')

function createStream (path) {
  const readStream = fs.createReadStream(path)
  return readStream
}

const isDevelopment = process.env.NODE_ENV !== 'production'
let manifestHash

// Hardcoded for demo only - should be kept track of
const password = 'password'
let fpath

const swarm = new SwarmClient({ bzz: 'http://localhost:8500' })

answerRenderer('upload-file', async params => {
  fpath = params.localPath
  const options = {
    contentType: params.type,
    path: params.distPath,
  }
  console.log(params, 'params')
  console.log('upload file', params)
  let encryptedStream = encrypt({file: params.localPath, password: password})
  console.log(encryptedStream, 'encryptedStream')
  manifestHash = await swarm.bzz.uploadTarStream(encryptedStream)
  console.log(manifestHash, 'manifestHash')
  return `app-file://${params.distPath}`
  // return 'hello'
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
      console.log('app on ready')
      // URL starts with `app-file://`
      const filePath = request.url.slice(11)
      console.log('request file', filePath)
      console.log(request, 'request')

      if (filePath.length === 0) {
        callback({
          mimeType: 'text/html',
          data: Buffer.from('<h5>Not found</h5>'),
        })
      } else {
        console.log('else')
        const encryptedStream = await swarm.bzz.downloadTar(manifestHash)
        // const data = await res.buffer()
        // const contentType = res.headers.get('Content-Type').split('; charset=')
        // callback({ data, mimeType: contentType[0], charset: contentType[1] })
        // const data = 'world'
        const data = createStream(filePath)
        // callback({data})
        console.log(data, 'data')
        callback({
          statusCode: 200,
          headers: {
            'content-type': 'image/jpg'
          },
          data: createStream(fpath)
        })
      }
    },
    error => {
      if (error) console.error('Failed to register protocol')
    },
  )

  mainWindow = createMainWindow()
})
