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
    try {
      const api = new Fastly({
        baseUri: baseUri,
        apiKey: apiKey,
      })

      const store = new JsonApiDataStore()

      const payload = await api.getDomains()
      const domains = store.sync(payload)

      hk.debug(`Located ${domains.length} tls domains linked to the fastly service`)

      const tlsDomain = store.find('tls_domain', domain)

      const state = tlsDomain.tls_subscriptions[0].state
      const challenges = tlsDomain.tls_subscriptions[0].tls_authorizations[0].challenges

      if (state === 'issued' || state === 'renewing') {
        hk.log(`The domain ${domain} is currently in a state of ${state}. It could take up to an hour for the certificate to propagate globally.\n`)

        hk.log('To use the certificate configure the following CNAME record\n')
        displayChallenge(challenges, 'managed-http-cname')

        hk.log('As an alternative to using a CNAME record the following A record can be configured\n')
        displayChallenge(challenges, 'managed-http-a')
      }

      if(state === 'pending' || state === 'processing') {
        hk.log(`The domain ${domain} is currently in a state of ${state} and the issuing of a certificate may take up to 30 minutes\n`)

        hk.log('To start the domain verification process create a DNS CNAME record with the following values\n')
        displayChallenge(challenges, 'managed-dns')

        hk.log('Alongside the initial verification record configure the following CNAME record\n')
        displayChallenge(challenges, 'managed-http-cname')

        hk.log('As an alternative to using a CNAME record the following A record can be configured\n')
        displayChallenge(challenges, 'managed-http-a')
      }

    }catch (e) {

      hk.error(`Fastly Plugin execution - ${e.name} - ${e.message}`)
      process.exit(1)
    }

  })();
}

function validateAPIKey(apiKey) {

  if (!apiKey) {
    hk.error('config var FASTLY_API_KEY not found! The Fastly add-on is required to configure TLS. Install Fastly at https://elements.heroku.com/addons/fastly')
    process.exit(1)
  }
}

function displayChallenge(challenges, type) {

  for (var i = 0; i < challenges.length; i++) {
    let challenge = challenges[i]
    if(challenge.type === type){
      hk.log(`DNS Record Type: ${challenge.record_type}`)
      hk.log(`DNS Record Name: ${challenge.record_name}`)
      hk.log(`DNS Record value(s): ${challenge.values.join(', ')}\n`)
    }
  }
}
