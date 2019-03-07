import { callMain } from 'electron-better-ipc'
import React, { Component, createRef } from 'react'
import { render } from 'react-dom'

class App extends Component {
  fileRef = createRef()

  state = {
    url: null,
    dataFetched: null,
    latestName: null,
    manifestHash: null,
  }

  setData = async () => {
    try {
      const response = await callMain('set', { data: 'some data' })
      this.setState({ manifestHash: response })
    }
    catch(error) {
      console.log(error, 'error')
    }
  }

  getData = async () => {
    try {
      const response = await callMain('get', { manifestHash: this.state.manifestHash })
      this.setState({ dataFetched: response })
    }
    catch(error) {
      console.log(error, 'error')
    }
  }

  onClick = async () => {
    const file = this.fileRef.current.files[0]
    console.log('file to upload', file)
    if (file != null) {
      try {
        const url = await callMain('upload-file', {
          localPath: file.path,
          distPath: file.name,
          type: file.type,
        })
        console.log('file uploaded', url)
        this.setState({ url })
      }
      catch(error) {
        console.log(error, 'error')
      }
    }
  }

  render() {
    const { url, manifestHash, dataFetched, latestName } = this.state

    return (
      <div>
        <p>{latestName}</p>
        <br/>
        <button onClick={this.setData}>Set Data</button> <code>data: {manifestHash}</code>
        <br/>
        <br/>
        <button onClick={this.getData}>Get Data</button> <code>data: {dataFetched}</code>
        <br/>
        <br/>
        <input type="file" ref={this.fileRef} />
        <button onClick={this.onClick}>Upload</button>
        {url ? <webview src={url} /> : null}
      </div>
    )
  }
}

render(<App />, document.getElementById('app'))
