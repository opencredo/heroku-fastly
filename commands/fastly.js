'use strict'

const fetch = require('node-fetch')

module.exports = class Fastly{

  constructor(config) {
    this.apiKey = config.apiKey
    this.baseUri = config.baseUri || "https://api.fastly.com"
  }

  request(endpoint = "", options = {}) {

    let url = this.baseUri + endpoint
    let headers = {
      'Fastly-Key': this.apiKey,
      'Accept': 'application/vnd.api+json',
      'Content-Type': ['application/vnd.api+json'],
    }
    let config = {
      ...headers,
      ...options
    }

    return fetch(url, config).then(r => {
      if (r.ok) {
        return r.json()
      }
      throw new Error(`Fastly API error - ${url} - ${r.status} ${r.statusText}`)
    })
  }

  createSubscription(domain) {
    const options = {
      method: 'POST',
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
    }
    return this.request('/tls/subscriptions', options)
  }

  getSubscription(id) {
    let url = `/tls/subscriptions/${id}?include=tls_authorizations`
    const options = {
      method: 'GET',
    }
    return this.request(url, options)
  }

  getSubscriptions() {
    let url = `/tls/subscriptions?include=tls_authorizations`
    const options = {
      method: 'GET',
    }
    return this.request(url, options)
  }

  deleteSubscription(id) {
    let url = `/tls/subscriptions/${id}`
    const options = {
      method: 'DELETE',
    }
    return this.request(url, options)
  }

  getDomains() {
    let url = `/tls/domains?include=tls_activations,tls_subscriptions.tls_authorizations,tls_subscriptions`
    const options = {
      method: 'GET',
    }
    return this.request(url, options)
  }

  getActivation(id) {
    let url = `/tls/activations/${id}`
    const options = {
      method: 'GET',
    }
    return this.request(url, options)
  }

}
