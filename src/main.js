const fs = require('fs')
const core = require('@actions/core')
const exec = require('./exec')
const Tail = require('tail').Tail

const snooze = (ms) => {
  return new Promise(resolve => {
    return setTimeout(resolve, ms)
  })
}

const run = async () => {
  const configFile = core.getInput('config_file').trim()
  const username = core.getInput('username').trim()
  const password = core.getInput('password').trim()
  const clientKey = core.getInput('client_key').trim()
  const tlsAuthKey = core.getInput('tls_auth_key').trim()

  if (!fs.existsSync(configFile)) {
    throw new Error(`config file '${configFile}' not found`)
  }

  // 1. Configure client

  fs.appendFileSync(configFile, '\n# ----- modified by action -----\n')

  // username & password auth
  if (username && password) {
    fs.appendFileSync(configFile, 'auth-user-pass up.txt\n')
    fs.writeFileSync('up.txt', [username, password].join('\n'))
  }

  // client certificate auth
  if (clientKey) {
    fs.appendFileSync(configFile, 'key client.key\n')
    fs.writeFileSync('client.key', clientKey)
  }

  if (tlsAuthKey) {
    fs.appendFileSync(configFile, 'tls-auth ta.key 1\n')
    fs.writeFileSync('ta.key', tlsAuthKey)
  }

  core.info('========== begin configuration ==========')
  core.info(fs.readFileSync(configFile, 'utf8'))
  core.info('=========== end configuration ===========')

  // 2. Run openvpn

  // prepare log file
  fs.writeFileSync('openvpn.log', '')
  const tail = new Tail('openvpn.log')

  try {
    core.info('VPN starting...')
    exec(`sudo openvpn --config ${configFile} --daemon --log openvpn.log --writepid openvpn.pid`)
  } catch (error) {
    core.error(fs.readFileSync('openvpn.log', 'utf8'))
    tail.unwatch()
    throw error
  }

  tail.on('line', (data) => {
    core.info(data)
    if (data.includes('Initialization Sequence Completed')) {
      core.info('VPN connected successfully.')
      tail.unwatch()
      clearTimeout(timer)
    }
  })

  const timer = setTimeout(() => {
    core.setFailed('VPN connection failed.')
    tail.unwatch()
  }, 15000)

  core.info('Waiting for PID...')
  await snooze(5000)
  const pid = fs.readFileSync('openvpn.pid', 'utf8').trim()
  core.info(`Daemon PID: ${pid}`)
  return pid
}

module.exports = run
