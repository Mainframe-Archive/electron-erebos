const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const getCipherKey = (password) => {
  return crypto.createHash('sha256').update(password).digest()
}

const decrypt = ({ stream, password }) => {
  // First, get the initialization vector from the file.
  const readInitVect = fs.createReadStream(stream, { end: 15 })

  let initVect

  readInitVect.on('data', (chunk) => {
    initVect = chunk
  })

  // Once we’ve got the initialization vector, we can decrypt the file.
  readInitVect.on('close', () => {
    const cipherKey = getCipherKey(password)
    const readStream = fs.createReadStream(file, { start: 16 })
    const decipher = crypto.createDecipheriv('aes256', cipherKey, initVect)
    const writeStream = fs.createWriteStream(file + '.unenc')

    readStream
      .pipe(decipher)
      .pipe(writeStream)
  })
}

module.exports = decrypt
