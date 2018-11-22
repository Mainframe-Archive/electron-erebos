import { callMain } from 'electron-better-ipc'
import React, { Component, createRef } from 'react'
import { render } from 'react-dom'

class App extends Component {
  fileRef = createRef()

  state = {
    url: null,
  }

  onClick = async () => {
    const file = this.fileRef.current.files[0]
    console.log('file to upload', file)
    if (file != null) {
      const url = await callMain('upload-file', {
        localPath: file.path,
        distPath: file.name,
        type: file.type,
      })
      console.log('file uploaded', url)
      this.setState({ url })
    }
  }

  render() {
    const { url } = this.state

    return (
      <div>
        <input type="file" ref={this.fileRef} />
        <button onClick={this.onClick}>Upload</button>
        {url ? <webview src={url} /> : null}
      </div>
    )
  }
}

render(<App />, document.getElementById('app'))
