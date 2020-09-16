'use strict'
const hk = require('heroku-cli-util')
const fetch = require('node-fetch');
const co = require('co')
var jp = require('jsonpath');

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
    method: 'post',
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': ['application/vnd.api+json'],
      'Fastly-Key': apiKey,
    },
    body: JSON.stringify({
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
    })
  };

  (async () => {
    try {
      const response = await fetch(`${baseUri}/tls/subscriptions`, options);
      const data = await response.json()

      if (!response.ok) {
        processError(response.status, response.statusText, data)
      }

      processCreateResponse(data, domain)

    } catch (error) {
      hk.error(`Fastly Plugin execution error - ${error.name} - ${error.message}`);
      process.exit(1);
    }

  })();
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
      // 1. Get a list of domains and locate the record for our current domain
      const domainResponse = await fetch(`${baseUri}/tls/domains`, options);
      const domainData = await domainResponse.json()

      if (!domainResponse.ok) {
        processError(domainResponse.status, domainResponse.statusText, domainData)
      }



      // 2. Delete the activations against the domain.
      options.method = 'DELETE'
      const activationResponse = await fetch(`${baseUri}/tls/activations/${tlsActivationId}`, options);
      const activationData = await activationResponse.json()



      if (!activationResponse.ok) {
        processError(activationResponse.status, activationResponse.statusText, activationData)
      }

      // 3. Delete the subscrption.
      options.method = 'DELETE'
      const response = await fetch(`${baseUri}/tls/subscriptions/tlsSubscriptionId`, options);
      const data = await response.json()

      if (!response.ok) {
        processError(response.status, response.statusText, data)
      }

      processDeleteResponse(data, domain)

    } catch (error) {
      hk.error(`Fastly Plugin execution error - ${error.name} - ${error.message}`);
      process.exit(1);
    }

  })();

}

function processCreateResponse(data, domain) {

  let acmeChallenge = jp.query(data, '$.included[*].attributes.challenges[?(@.type == \'managed-dns\')]')[0];
  let cnameChallenge = jp.query(data, '$.included[*].attributes.challenges[?(@.type == \'managed-http-cname\')]')[0];
  let aChallenge = jp.query(data, '$.included[*].attributes.challenges[?(@.type == \'managed-http-a\')]')[0];

  hk.styledHeader(`Domain ${domain} has been queued for TLS certificate addition. This may take a few minutes.\n`);
  hk.styledHeader(`To start the domain verification process create a DNS ${acmeChallenge.record_type} record.\n`)
  hk.log(`${acmeChallenge.record_type} ${acmeChallenge.record_name} ${acmeChallenge.values[0]}\n`);

  hk.styledHeader(`Alongside the initial verification record either the following CNAME and/or A records are required.\n`);
  hk.log(`${cnameChallenge.record_type} ${cnameChallenge.record_name} ${cnameChallenge.values[0]}\n`);
  hk.log(`${aChallenge.record_type} ${aChallenge.record_name} ${aChallenge.values[0]}, ${aChallenge.values[1]}, ${aChallenge.values[2]}, ${aChallenge.values[3]}`);
}

function processError(status, statusText, data) {

  let errors = data.errors
  let errorMessage = `Fastly API request Error - code: ${status} ${statusText}\n`

  for (var i = 0; i < errors.length; i++) {
    errorMessage += `${errors[i].title} - ${errors[i].detail}\n`
  }

  hk.error(errorMessage.trim())
  process.exit(1)
}
