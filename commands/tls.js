'use strict'
const hk = require('heroku-cli-util')
const co = require('co')
const Fastly = require('./fastly.js')

const JsonApiDataStore = require('jsonapi-datastore').JsonApiDataStore

module.exports = {
  topic: 'fastly',
  command: 'tls',
  description: 'Add/Remove Fastly TLS to DOMAIN',
  help:
    'DOMAIN will be added to a Fastly Heroku SAN SSL certificate. \n\n\
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
    {
      name: 'delete',
      char: 'd',
      description: 'Remove TLS from DOMAIN',
      hasValue: false,
    },
    {
      name: 'api_uri',
      char: 'u',
      description: 'Override Fastly API URI',
      hasValue: true,
    },
    {
      name: 'api_key',
      char: 'k',
      description: 'Override FASTLY_API_KEY config var',
      hasValue: true,
    },
  ],

  run: hk.command(function (context, heroku) {
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
    hk.error(
      'config var FASTLY_API_KEY not found! The Fastly add-on is required to configure TLS. Install Fastly at https://elements.heroku.com/addons/fastly'
    )
    process.exit(1)
  }
}

function createFastlyTlsSubscription(apiKey, baseUri, domain) {
  ;(async () => {
    try {
      const api = new Fastly({
        baseUri: baseUri,
        apiKey: apiKey,
      })

      const store = new JsonApiDataStore()

      const payload = await api.createSubscription(domain)

      let subscription = store.sync(payload)
      let state = subscription.state
      let challenges = subscription.tls_authorizations[0].challenges

      if (state === 'issued' || state === 'renewing') {
        hk.log(
          `The domain ${domain} is currently in a state of ${state}. It could take up to an hour for the certificate to propagate globally.\n`
        )

        hk.log('To use the certificate configure the following CNAME record\n')
        displayChallenge(challenges, 'managed-http-cname')

        hk.log(
          'As an alternative to using a CNAME record the following A record can be configured\n'
        )
        displayChallenge(challenges, 'managed-http-a')
      }

      if (state === 'pending' || state === 'processing') {
        hk.log(
          `The domain ${domain} is currently in a state of ${state} and the issuing of a certificate may take up to 30 minutes\n`
        )

        hk.log(
          'To start the domain verification process create a DNS CNAME record with the following values\n'
        )
        displayChallenge(challenges, 'managed-dns')

        hk.log(
          'Alongside the initial verification record configure the following CNAME record\n'
        )
        displayChallenge(challenges, 'managed-http-cname')

        hk.log(
          'As an alternative to using a CNAME record the following A record can be configured\n'
        )
        displayChallenge(challenges, 'managed-http-a')
      }
    } catch (error) {
      hk.error(
        `Fastly Plugin execution error - ${error.name} - ${error.message}`
      )
      process.exit(1)
    }
  })()
}

function deleteFastlyTlsSubscription(apiKey, baseUri, domain) {
  const options = {
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': ['application/vnd.api+json'],
      'Fastly-Key': apiKey,
    },
  }

  ;(async () => {
    try {
      const api = new Fastly({
        baseUri: baseUri,
        apiKey: apiKey,
      })

      const store = new JsonApiDataStore()

      const payload = await api.getDomains()
      const domains = store.sync(payload)

      hk.debug(
        `Located ${domains.length} tls domains linked to the fastly service`
      )

      const tlsDomain = store.find('tls_domain', domain)

      if (tlsDomain) {
        let subscriptions = tlsDomain.tls_subscriptions

        let activations = tlsDomain.tls_activations

        if (activations.length > 0) {
          let activationId = activations[0].id
          await api.deleteActivation(activationId)
          hk.log(`TLS subscription for domain ${domain} has been deactivated`)
        } else {
          hk.log(`TLS subscription for domain ${domain} was not active`)
        }

        if (subscriptions.length > 0) {
          let subscriptionId = subscriptions[0].id
          await api.deleteSubscription(subscriptionId)
          hk.log(`TLS subscription for domain ${domain} has been removed`)
        }

        hk.log('This domain will no longer support TLS')
      } else {
        hk.warn(`Domain ${domain} does not support TLS.`)
      }
    } catch (error) {
      hk.error(
        `Fastly Plugin execution error - ${error.name} - ${error.message}`
      )
      process.exit(1)
    }
  })()
}

function processCreateResponse(data, domain) {
  let acmeChallenge = jp.query(
    data,
    "$.included[*].attributes.challenges[?(@.type == 'managed-dns')]"
  )[0]
  let cnameChallenge = jp.query(
    data,
    "$.included[*].attributes.challenges[?(@.type == 'managed-http-cname')]"
  )[0]
  let aChallenge = jp.query(
    data,
    "$.included[*].attributes.challenges[?(@.type == 'managed-http-a')]"
  )[0]

  hk.styledHeader(
    `Domain ${domain} has been queued for TLS certificate addition. This may take a few minutes.\n`
  )
  hk.styledHeader(
    `To start the domain verification process create a DNS ${acmeChallenge.record_type} record.\n`
  )
  hk.log(
    `${acmeChallenge.record_type} ${acmeChallenge.record_name} ${acmeChallenge.values[0]}\n`
  )

  hk.styledHeader(
    'Alongside the initial verification record either the following CNAME and/or A records are required.\n'
  )
  hk.log(
    `${cnameChallenge.record_type} ${cnameChallenge.record_name} ${cnameChallenge.values[0]}\n`
  )
  hk.log(
    `${aChallenge.record_type} ${aChallenge.record_name} ${aChallenge.values[0]}, ${aChallenge.values[1]}, ${aChallenge.values[2]}, ${aChallenge.values[3]}`
  )
}

function processDeleteResponse(domain) {
  hk.styledHeader(
    `Domain ${domain} queued for TLS removal. This domain will no longer support TLS`
  )
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

function displayChallenge(challenges, type) {
  for (var i = 0; i < challenges.length; i++) {
    let challenge = challenges[i]
    if (challenge.type === type) {
      hk.log(`DNS Record Type: ${challenge.record_type}`)
      hk.log(`DNS Record Name: ${challenge.record_name}`)
      hk.log(`DNS Record value(s): ${challenge.values.join(', ')}\n`)
    }
  }
}
