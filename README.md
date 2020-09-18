# Heroku Fastly Plugin

Heroku CLI plugin for interacting with fastly configuration.



# Installation
Install the heroku-fastly plugin using the `heroku plugins` command. More details are available in Heroku's [Devcenter](https://devcenter.heroku.com/articles/using-cli-plugins).

```
heroku plugins:install @fastly/heroku-plugin
```

# Usage
The CLI Plugin includes the commands: `tls`, `verify`, and `purge`.
****
## TLS and Verify
To add TLS to a domain your pricing plan must include a TLS domain and the domain must be configured in the active version of your Fastly Service.
The process involves creating the TLS Domain, verifying ownership of your domain, and checking the verification status of your domain. Usage:

```
heroku fastly:tls DOMAIN --app [HEROKU_APP_NAME]
```

To add TLS/SSL to a custom domain:

```
heroku fastly:tls www.example.org --app my-fast-app
```
The output of add TLS/SSL command will provide the required DNS record values that need to be 
add to your DNS provider configuration.  These include the acme challenge as well as A/CNAME record entries.

```
heroku fastly:verify www.example.org
```
Verifies the state of the add TLS/SSL request.

```
heroku fastly:verify www.example.org
```

To remove TLS/SSL from a custom domain, include the the `-d` flag:

```
heroku fastly:tls -d www.example.org --app my-fast-app
```

## Purge
Issue a surrogate key purge or purge all. For reference, see the [Purge API docs](https://docs.fastly.com/api/purge). Usage:

```
heroku fastly:purge [KEY]
```

To purge the entire cache:

```
heroku fastly:purge --all --app my-fast-app
```

To purge a surrogate-key from the cache:

```
heroku fastly:purge my-surrogate-key --app my-fast-app
```

To [softpurge](https://docs.fastly.com/api/purge#soft_purge) a key from the cache:

```
heroku fastly:purge my-surrogate-key --soft --app my-fast-app
```

# Development
Clone the repo and run `npm install` to install dependencies.

Further detail on building Heroku CLI plugins is available in the [devcenter](https://devcenter.heroku.com/articles/developing-cli-plugins).

* Clone this repo.
* `cd` into `heroku-fastly` repo
* Run `npm install`.
* Run `heroku plugins:link`. 
* You can make sure this is working by running `heroku plugins`, will return something like:

```
heroku-fastly 1.0.7 (link) /Users/your-path/heroku-fastly
```

* Test `tls` command. Run `heroku fastly:tls www.example.org --app my-fast-app`. This command will return something like:

```
=== Domain www.example.org has been queued for TLS certificate addition. This may take a few minutes.
 ▸    In the mean time, start the domain verification process by creating a DNS TXT record containing the following content:
 ▸
 ▸
 ▸    Once you have added this TXT record you can start the verification process by running:
 ▸
 ▸    $ heroku fastly:verify start DOMAIN —app APP
 ```

* Test `verify` command. Run `heroku fastly:verify www.example.org`, will return something like: 

```
 ▸    Valid approval domains: example.org, www.example.org
Type the approval domain to use (or ENTER if only 1): : ^C
```

* Test `purge` command. Run `heroku fastly:purge --all --app my-fast-app`, will return something like:

```
{ status: 'ok' }
```

## Testing
Tests can be run with `npm test`.

## Publishing

- We follow [Semantic versioning](https://semver.org/) with regards to the
  version of this plugin. Any pull-requests to this project must include an
  appropriate change to the `package.json` file (as well as the
  `package-lock.json` file) and the `CHANGELOG.md` file.

- After any PR has been merged, run an `npm publish` command from the `master`
  branch after pulling all changes in from `github`.

## Contact us
Have an issue? Please send an email to support@fastly.com.

## Contributing
Want to see new functionality? Please open a pull request.


