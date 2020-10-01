'use strict'

const utils = require('../commands/utils')

describe('interaction with utils functions', () => {
  const consoleSpy = jest.spyOn(console, 'log')

  beforeEach(() => {
    consoleSpy.mockReset()
  })

  const testChallenges = [
    {
      type: 'managed-dns',
      record_type: 'CNAME',
      record_name: '_acme-challenge.www.example.org',
      values: ['dvxzuc4govtr3juagj.fastly-validations.com'],
    },
    {
      type: 'managed-http-cname',
      record_type: 'CNAME',
      record_name: 'www.example.org',
      values: ['j.sni.global.fastly.net'],
    },
    {
      type: 'managed-http-a',
      record_type: 'A',
      record_name: 'www.example.org',
      values: [
        '151.101.2.132',
        '151.101.66.132',
        '151.101.130.132',
        '151.101.194.132',
      ],
    },
  ]

  it('confirm managed-dns challenge renders correctly', async () => {
    utils.displayChallenge(testChallenges, 'managed-dns')

    expect(consoleSpy).toHaveBeenCalledTimes(3)
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Type: CNAME')
    expect(consoleSpy).toHaveBeenCalledWith(
      'DNS Record Name: _acme-challenge.www.example.org'
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'DNS Record value(s): dvxzuc4govtr3juagj.fastly-validations.com\n'
    )
  })

  it('confirm managed-http-cname challenge renders correctly', async () => {
    utils.displayChallenge(testChallenges, 'managed-http-cname')

    expect(consoleSpy).toHaveBeenCalledTimes(3)
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Type: CNAME')
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Name: www.example.org')
    expect(consoleSpy).toHaveBeenCalledWith(
      'DNS Record value(s): j.sni.global.fastly.net\n'
    )
  })

  it('confirm managed-http-a challenge renders correctly', async () => {
    utils.displayChallenge(testChallenges, 'managed-http-a')

    expect(consoleSpy).toHaveBeenCalledTimes(3)
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Type: A')
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Name: www.example.org')
    expect(consoleSpy).toHaveBeenCalledWith(
      'DNS Record value(s): 151.101.2.132, 151.101.66.132, 151.101.130.132, 151.101.194.132\n'
    )
  })

  it('confirm managed-http-a challenge renders correctly with fewer ip addresses', async () => {
    const challenges = [
      {
        type: 'managed-http-a',
        record_type: 'A',
        record_name: 'www.example.org',
        values: ['151.101.2.132', '151.101.66.132'],
      },
    ]

    utils.displayChallenge(challenges, 'managed-http-a')

    expect(consoleSpy).toHaveBeenCalledTimes(3)
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Type: A')
    expect(consoleSpy).toHaveBeenCalledWith('DNS Record Name: www.example.org')
    expect(consoleSpy).toHaveBeenCalledWith(
      'DNS Record value(s): 151.101.2.132, 151.101.66.132\n'
    )
  })
})
