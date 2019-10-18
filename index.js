const bump = require('./lib/lifecycles/bump')
const changelog = require('./lib/lifecycles/changelog')
const commit = require('./lib/lifecycles/commit')
const fs = require('fs')
const latestSemverTag = require('./lib/latest-semver-tag')
const path = require('path')
const printError = require('./lib/print-error')
const tag = require('./lib/lifecycles/tag')

module.exports = function standardVersion (argv) {
  /**
   * `--message` (`-m`) support will be removed in the next major version.
   */
  const message = argv.m || argv.message
  if (message) {
    /**
     * The `--message` flag uses `%s` for version substitutions, we swap this
     * for the substitution defined in the config-spec for future-proofing upstream
     * handling.
     */
    argv.releaseCommitMessageFormat = message.replace(/%s/g, '{{currentTag}}')
    if (!argv.silent) {
      console.warn('[standard-version]: --message (-m) will be removed in the next major release. Use --releaseCommitMessageFormat.')
    }
  }

  let pkg
  bump.pkgFiles.forEach((filename) => {
    if (pkg) return
    const pkgPath = path.resolve(process.cwd(), filename)
    try {
      const data = fs.readFileSync(pkgPath, 'utf8')
      pkg = JSON.parse(data)
    } catch (err) {}
  })
  let newVersion
  const defaults = require('./defaults')
  const args = Object.assign({}, defaults, argv)

  return Promise.resolve()
    .then(() => {
      if (!pkg && args.gitTagFallback) {
        return latestSemverTag()
      } else if (!pkg) {
        throw new Error('no package file found')
      } else {
        return pkg.version
      }
    })
    .then(version => {
      newVersion = version
    })
    .then(() => {
      if(!args.fromScratch) {
        return bump(args, newVersion)
      }
      return Promise.resolve()
    })
    .then((_newVersion) => {
      // if bump runs, it calculaes the new version that we
      // should release at.
      if (_newVersion) newVersion = _newVersion
      return changelog(args, newVersion)
    })
    .then(() => {
      if(!args.fromScratch) {
        return commit(args, newVersion)
      }
      return Promise.resolve()
    })
    .then(() => {
      if(!args.fromScratch) {
        return tag(newVersion, pkg ? pkg.private : false, args)
      }
      return Promise.resolve()
    })
    .catch((err) => {
      printError(args, err.message)
      throw err
    })
}
