const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const PrependInitVect = require('./prepend-init-vect.js')

const getCipherKey = (password) => {
  return crypto.createHash('sha256').update(password).digest()
}

const encrypt = ({ file, password }) => {
  // Generate a secure, pseudo random initialization vector.
  const initVect = crypto.randomBytes(16)

  // Generate a cipher key from the password.
  const cipherKey = getCipherKey(password)
  const readStream = fs.createReadStream(file)
  const cipher = crypto.createCipheriv('aes256', cipherKey, initVect)
  const prependInitVect = new PrependInitVect(initVect)
  // Create a write stream with a different file extension.
  // const writeStream = fs.createWriteStream(path.join(file + ".enc"))
  // 
  return readStream
    .pipe(cipher)
    .pipe(prependInitVect)
  // .pipe(writeStream)
}

module.exports = encrypt
