const { Transform } = require('stream')

class PrependInitVect extends Transform {
  constructor(initVect, opts) {
    super(opts)
    this.initVect = initVect
    this.prepended = false
  }

  _transform(chunk, encoding, callback) {
    if (!this.prepended) {
      this.push(this.initVect)
      this.prepended = true
    }
    this.push(chunk)
    callback()
  }
}

module.exports = PrependInitVect
