'use strict'
const hk = require('heroku-cli-util')
const request = require('request')
const co = require('co')

module.exports = {

  topic: 'fastly',
  command: 'tls',
  description: 'Add/Remove Fastly TLS to DOMAIN',
  help: 'TODO - Update documentation to reflect the use of tls/subscriptions',
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
      let subscriptionUri = `${baseUri}/tls/subscriptions`

      let config = yield heroku.get(`/apps/${context.app}/config-vars`)
      let apiKey = context.flags.api_key || config.FASTLY_API_KEY

      validateAPIKey(apiKey)

      if (context.flags.delete) {


        let tlsSubscriptionId = config.FASTLY_TLS_SUBSCRIPTION_ID
        validateTlsSubscriptionId(tlsSubscriptionId)

        deleteFastlyTlsSubscription(apiKey, subscriptionUri, tlsSubscriptionId, function(error, response, body) {
          if (response.statusCode != 200) {

            handleErrors(response, body)

          } else {

            heroku.patch(`/apps/${context.app}/config-vars`, {body: {FASTLY_TLS_SUBSCRIPTION_ID: null}}).then(app => {
              hk.styledHeader(`Domain ${context.args.domain} TLS removed. This domain will no longer support TLS`)
            })

          }
        })

      } else {

        createFastlyTlsSubscription(apiKey, subscriptionUri, context.args.domain, function(error, response, body) {
          if (response.statusCode != 200) {

            handleErrors(response, body)

          } else {

            hk.styledHeader(`Domain ${context.args.domain} TLS created. This domain will no longer support TLS`)
          }
          console.log(response.body)
        })

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

function validateTlsSubscriptionId(tlsSubscriptionId) {

  if (!tlsSubscriptionId) {
    hk.error('config var FASTLY_TLS_SUBSCRIPTION_ID not found! An existing TLS Subscription must be present to delete it.')
    process.exit(1)
  }
}

function handleErrors(response, body) {

  let errors = JSON.parse(body).errors
  let errorMessage = `Fastly API request Error - code: ${response.statusCode} ${response.statusMessage}\n`

  for (var i = 0; i < errors.length; i++) {
    errorMessage += `${errors[i].title} - ${errors[i].detail}\n`
  }

  hk.error(errorMessage.trim())
  process.exit(1)
}

function createFastlyTlsSubscription(apiKey, subscriptionUri, domain, callback) {

  request(
    subscriptionUri,
    {
      method: 'POST',
      'headers': {
        'Accept': 'application/vnd.api+json',
        'Content-Type': ['application/vnd.api+json'],
        'Fastly-Key': apiKey,
      },
      'body': JSON.stringify({
        data: {
          type: "tls_subscription",
          attributes: {
            certificate_authority: "lets-encrypt"
          },
          relationships: {
            tls_domains: {
              data: [
                { type: "tls_domain", id: domain }
              ]
            },
            tls_configuration: {
              data: {}
            }
          }
        }
      }),
    },
    callback)
}

function deleteFastlyTlsSubscription(apiKey, subscriptionUri, tlsSubscriptionId, callback) {

  request(
    `${subscriptionUri}/${tlsSubscriptionId}`,
    {
      method: 'DELETE',
      'headers': {
        'Accept': 'application/vnd.api+json',
        'Content-Type': ['application/vnd.api+json'],
        'Fastly-Key': apiKey,
      },
    },
    callback)
}
