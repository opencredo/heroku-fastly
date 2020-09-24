'use strict'
const hk = require('heroku-cli-util')
const co = require('co')
const Fastly = require('./fastly.js')

const JsonApiDataStore = require('jsonapi-datastore').JsonApiDataStore

module.exports = {
  topic: 'fastly',
  command: 'verify',
  description: 'Check the status of the Fastly TLS subscription.',
  help: 'A command that allows the status of the Fastly TLS subscription to be checked.',
  needsApp: true,
  needsAuth: true,
  args: [
    { name: 'domain', description: 'The domain to check', optional: false },
  ],
  flags: [
    { name: 'api_uri', char: 'u', description: 'Override Fastly API URI', hasValue: true },
    { name: 'api_key', char: 'k', description: 'Override Fastly_API_KEY config var', hasValue: true },
  ],
  run: hk.command(function(context, heroku) {
    return co(function* () {

      let baseUri = context.flags.api_uri || 'https://api.fastly.com'
      let config = yield heroku.get(`/apps/${context.app}/config-vars`)
      let apiKey = context.flags.api_key || config.FASTLY_API_KEY
      let domain = context.args.domain

      validateAPIKey(apiKey)

      verifyFastlyTlsSubscription(apiKey, baseUri, domain)
    })
  }),
}

function verifyFastlyTlsSubscription(apiKey, baseUri, domain) {

  (async () => {

    const api = new Fastly({
      baseUri: `${baseUri}`,
      apiKey: `${apiKey}`,
    })

    const store = new JsonApiDataStore()

    const payload = await api.getDomains()
    const domains = store.sync(payload)

    hk.log(domains)

  })();



}

function validateAPIKey(apiKey) {

  if (!apiKey) {
    hk.error('config var FASTLY_API_KEY not found! The Fastly add-on is required to configure TLS. Install Fastly at https://elements.heroku.com/addons/fastly')
    process.exit(1)
  }
}

function processVerifyResponse(data, domain) {

}
