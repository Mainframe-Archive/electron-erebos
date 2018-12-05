const fs = require('fs')
const encrypt = require('./encrypt')
const decrypt = require('./decrypt')

// pull the mode, file and password from the command arguments.
const [ mode, file, password ] = process.argv.slice(2)

if (mode === 'encrypt') {
  encrypt({ file, password })
  const a = fs.readFileSync(file)
}
if (mode === 'decrypt') {
  decrypt({ file, password })
}
