const core = require('@actions/core')
const coreCommand = require('@actions/core/lib/command')
const main = require('./main')
const post = require('./post')

const start = async () => {
  const isPost = !!process.env.STATE_isPost

  if (isPost) {
    // cleanup
    const pid = process.env.STATE_pid
    try {
      post(pid)
    } catch (error) {
      core.setFailed(error.message)
    }
  } else {
    // main
    try {
      const pid = await main()
      coreCommand.issueCommand('save-state', { name: 'pid' }, pid)
    } catch (error) {
      core.setFailed(error.message)
    } finally {
      // cf. https://github.com/actions/checkout/blob/main/src/state-helper.ts
      coreCommand.issueCommand('save-state', { name: 'isPost' }, 'true')
    }
  }
}

start()
