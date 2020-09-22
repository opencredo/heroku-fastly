'use strict'
const hk = require('heroku-cli-util')
const fetch = require('node-fetch')
const co = require('co')
const jp = require('jsonpath')

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

  const options = {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': ['application/vnd.api+json'],
      'Fastly-Key': apiKey,
    },
  };

  (async () => {
    try {

      // 1. Get a list of domains to locate subscription id.
      const domainResponse = await fetch(`${baseUri}/tls/domains`, options)
      const domainData = await domainResponse.json()

      if (!domainResponse.ok) {
        processError(domainResponse.status, domainResponse.statusText, domainData)
      }

      let tlsSubscriptionId = jp.query(domainData, `$.data[?(@.id == \'${domain}\')].relationships.tls_subscriptions.data[0].id`)

      // 2. Locate the current state of the TLS subscription.
      if (tlsSubscriptionId) {
        options.method = 'GET'
        const response = await fetch(`${baseUri}/tls/subscriptions/${tlsSubscriptionId}`, options)
        const data = await response.json()

        if (!response.ok) {

          processError(response.status, response.statusText, data)
        }

        processVerifyResponse(data, domain)
      } else {
        hk.warn(`Domain ${domain} does not support TLS.`)
      }

    } catch (error) {
      hk.error(`Fastly Plugin execution error - ${error.name} - ${error.message}`)
      process.exit(1)
    }

  })()

}

function validateAPIKey(apiKey) {

  if (!apiKey) {
    hk.error('config var FASTLY_API_KEY not found! The Fastly add-on is required to configure TLS. Install Fastly at https://elements.heroku.com/addons/fastly')
    process.exit(1)
  }
}

function processVerifyResponse(data, domain) {

  let status = jp.query(data, `$['data']['attributes'].state`)

  hk.styledHeader(`Domain ${domain} TLS subscription state: ${status}`)

  if (status === 'issued' || status === 'renewing') {
    hk.log(`Domain ${domain} supporting TLS.`)
  } else {
    hk.log(`The issuing of a certificate may take up to 30 minutes.  In the mean time please confirm your DNS records are configured with your DNS provider for ${domain}`)
  }

  hk.log()
}
