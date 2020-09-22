'use strict'
const hk = require('heroku-cli-util')
const fetch = require('node-fetch')
const co = require('co')
const jp = require('jsonpath')

module.exports = {

  topic: 'fastly',
  command: 'tls',
  description: 'Add/Remove Fastly TLS to DOMAIN',
  help: 'DOMAIN will be added to a Fastly Heroku SAN SSL certificate. \n\n\
Requirements: \n\
 - The Fastly Service must have DOMAIN configured in the active version \n\
 - Heroku pricing plan must include TLS Domain(s) \n\
 - Wildcard domains are not allowed \n\n\
Usage: \n\
  heroku fastly:tls www.example.org --app my-fast-app\n ',
  needsApp: true,
  needsAuth: true,
  args: [{ name: 'domain', description: 'The domain for TLS configure' }],
  flags: [
    { name: 'delete', char: 'd', description: 'Remove TLS from DOMAIN', hasValue: false },
    { name: 'api_uri', char: 'u', description: 'Override Fastly API URI', hasValue: true },
    { name: 'api_key', char: 'k', description: 'Override FASTLY_API_KEY config var', hasValue: true },
  ],

  run: hk.command(function(context, heroku) {
    return co(function* () {

      let baseUri = context.flags.api_uri || 'https://api.fastly.com'
      let config = yield heroku.get(`/apps/${context.app}/config-vars`)
      let apiKey = context.flags.api_key || config.FASTLY_API_KEY
      let domain = context.args.domain

      validateAPIKey(apiKey)

      if (context.flags.delete) {

        deleteFastlyTlsSubscription(apiKey, baseUri, domain)

      } else {

        createFastlyTlsSubscription(apiKey, baseUri, domain)

      }
    })
  }),
}

function validateAPIKey(apiKey) {

  if (!apiKey) {
    hk.error('config var FASTLY_API_KEY not found! The Fastly add-on is required to configure TLS. Install Fastly at https://elements.heroku.com/addons/fastly')
    process.exit(1)
  }
}

function createFastlyTlsSubscription(apiKey, baseUri, domain) {

  const options = {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': ['application/vnd.api+json'],
      'Fastly-Key': apiKey,
    },
    body: JSON.stringify({
      data: {
        type: 'tls_subscription',
        attributes: {
          certificate_authority: 'lets-encrypt',
        },
        relationships: {
          tls_domains: {
            data: [
              { type: 'tls_domain', id: domain },
            ],
          },
          tls_configuration: {
            data: {},
          },
        },
      },
    }),
  };

  (async () => {
    try {
      const response = await fetch(`${baseUri}/tls/subscriptions`, options)
      const data = await response.json()

      if (!response.ok) {
        processError(response.status, response.statusText, data)
      }

      processCreateResponse(data, domain)

    } catch (error) {
      hk.error(`Fastly Plugin execution error - ${error.name} - ${error.message}`)
      process.exit(1)
    }

  })()
}

function deleteFastlyTlsSubscription(apiKey, baseUri, domain) {

  const options = {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': ['application/vnd.api+json'],
      'Fastly-Key': apiKey,
    },
  };

  (async () => {
    try {

      // 1. Get a list of domains to locate activation and subscription ids.
      const domainResponse = await fetch(`${baseUri}/tls/domains`, options)
      const domainData = await domainResponse.json()

      if (!domainResponse.ok) {
        processError(domainResponse.status, domainResponse.statusText, domainData)
      }

      let tlsActivationId = jp.query(domainData, `$.data[?(@.id == \'${domain}\')].relationships.tls_activations.data[0].id`)
      let tlsSubscriptionId = jp.query(domainData, `$.data[?(@.id == \'${domain}\')].relationships.tls_subscriptions.data[0].id`)

      // 2. Delete the activations against the domain.
      if (tlsActivationId) {
        options.method = 'DELETE'
        const activationResponse = await fetch(`${baseUri}/tls/activations/${tlsActivationId}`, options)

        if (!activationResponse.ok) {
          const activationData = await activationResponse.json()
          processError(activationResponse.status, activationResponse.statusText, activationData)
        }
      } else {
        hk.warn(`TLS was not activate on domain ${domain}.`)
      }

      // 3. Delete the subscription against the domain.
      if (tlsSubscriptionId) {
        options.method = 'DELETE'
        const response = await fetch(`${baseUri}/tls/subscriptions/${tlsSubscriptionId}`, options)

        if (!response.ok) {
          const data = await response.json()
          processError(response.status, response.statusText, data)
        }

        processDeleteResponse(domain)
      } else {
        hk.warn(`Domain ${domain} does not support TLS.`)
      }

    } catch (error) {
      hk.error(`Fastly Plugin execution error - ${error.name} - ${error.message}`)
      process.exit(1)
    }

  })()

}

function processCreateResponse(data, domain) {

  let acmeChallenge = jp.query(data, '$.included[*].attributes.challenges[?(@.type == \'managed-dns\')]')[0]
  let cnameChallenge = jp.query(data, '$.included[*].attributes.challenges[?(@.type == \'managed-http-cname\')]')[0]
  let aChallenge = jp.query(data, '$.included[*].attributes.challenges[?(@.type == \'managed-http-a\')]')[0]

  hk.styledHeader(`Domain ${domain} has been queued for TLS certificate addition. This may take a few minutes.\n`)
  hk.styledHeader(`To start the domain verification process create a DNS ${acmeChallenge.record_type} record.\n`)
  hk.log(`${acmeChallenge.record_type} ${acmeChallenge.record_name} ${acmeChallenge.values[0]}\n`)

  hk.styledHeader(`Alongside the initial verification record either the following CNAME and/or A records are required.\n`)
  hk.log(`${cnameChallenge.record_type} ${cnameChallenge.record_name} ${cnameChallenge.values[0]}\n`)
  hk.log(`${aChallenge.record_type} ${aChallenge.record_name} ${aChallenge.values[0]}, ${aChallenge.values[1]}, ${aChallenge.values[2]}, ${aChallenge.values[3]}`)
}

function processDeleteResponse(domain) {

  hk.styledHeader(`Domain ${domain} queued for TLS removal. This domain will no longer support TLS`)
}

function processError(status, statusText, data) {

  let errorMessage = `Fastly API request Error - code: ${status} ${statusText}\n`

  if (data != null) {
    let errors = data.errors
    for (var i = 0; i < errors.length; i++) {
      errorMessage += `${errors[i].title} - ${errors[i].detail}\n`
    }
  }

  hk.error(errorMessage.trim())
  process.exit(1)
}
