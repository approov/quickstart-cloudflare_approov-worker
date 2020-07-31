module.exports = {
    target: 'webworker',
    entry: './jwt-verifier.js',
    output: {
        filename: 'worker.js'
    }
}
