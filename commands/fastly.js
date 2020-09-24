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
      'Content-Type': 'application/vnd.api+json',
    }
    let config = {
      ...options,
      headers: headers,
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
    let endpoint = `/tls/subscriptions/${id}?include=tls_authorizations`
    const options = {
      method: 'GET',
    }
    return this.request(endpoint, options)
  }

  getSubscriptions() {
    let endpoint = '/tls/subscriptions?include=tls_authorizations'
    const options = {
      method: 'GET',
    }
    return this.request(endpoint, options)
  }

  deleteSubscription(id) {
    let endpoint = `/tls/subscriptions/${id}`
    const options = {
      method: 'DELETE',
    }
    return this.request(endpoint, options)
  }

  getDomains() {
    let endpoint = '/tls/domains?include=tls_activations,tls_subscriptions.tls_authorizations,tls_subscriptions'
    const options = {
      method: 'GET',
    }
    return this.request(endpoint, options)
  }

  getActivation(id) {
    let endpoint = `/tls/activations/${id}`
    const options = {
      method: 'GET',
    }
    return this.request(endpoint, options)
  }

}
